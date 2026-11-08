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
FROM lukemathwalker/cargo-chef:0.1.78-rust-1-slim-bookworm AS chef
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends sqlite3 && rm -rf /var/lib/apt/lists/*
# DB only exists so sqlx's query! macros can check queries at compile time
ENV DATABASE_URL=sqlite:///my-music-data/db
RUN mkdir -p /my-music-data
COPY migrations migrations
RUN for f in $(printf "%s\n" migrations/*.sql | sort -V); do sqlite3 /my-music-data/db < "$f"; done

# 4. Rust Planner Stage
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# 5. Rust Builder Stage
FROM chef AS builder 
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies - this is the caching Docker layer!
RUN cargo chef cook --release -p my-music --recipe-path recipe.json
# Build application
COPY migrations migrations
COPY src src
COPY Cargo.toml Cargo.toml
COPY Cargo.lock Cargo.lock
RUN cargo build --release -p my-music

# 6. Final Runtime Stage
FROM debian:bookworm-slim AS runtime
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
