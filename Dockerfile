# 1. Web Build Stage
FROM --platform=$BUILDPLATFORM node:23-bookworm-slim AS web-build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY web /web
WORKDIR /web
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

# 2. Downloader Stage (Keeps curl/unzip out of runtime)
FROM debian:bookworm-slim AS downloader
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip ca-certificates
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /bin/yt-dlp \
    && chmod a+rx /bin/yt-dlp

# 3. Rust Chef Stage
FROM --platform=$BUILDPLATFORM debian:bookworm-slim AS chef
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl ca-certificates
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN cargo install --locked --version 0.1.77 cargo-chef
RUN cargo install --locked --version 0.8.3 sqlx-cli --no-default-features --features rustls,sqlite
ENV DATABASE_URL=sqlite:///my-music-data/db
RUN mkdir -p /my-music-data
RUN sqlx database create
COPY migrations migrations
RUN sqlx migrate run

# 4. Rust Planner Stage
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# 5. Rust Builder Stage
FROM chef AS builder 
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY migrations migrations
COPY src src
COPY Cargo.toml Cargo.toml
COPY Cargo.lock Cargo.lock
RUN cargo build --release

# 6. Final Runtime Stage
FROM --platform=$BUILDPLATFORM debian:bookworm-slim AS runtime
WORKDIR /

# Install only required dependencies, avoid recommends, and clean cache
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-mutagen \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy external binaries from downloader
COPY --from=downloader /usr/local/bin/deno /usr/local/bin/deno
COPY --from=downloader /bin/yt-dlp /bin/yt-dlp

# Copy application files
COPY --from=web-build /web/dist /my-music-web
COPY --from=builder /app/target/release/my-music /my-music

ENTRYPOINT ["/my-music"]
