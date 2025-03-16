FROM --platform=$BUILDPLATFORM node:23-bullseye-slim AS web-build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY web /web
WORKDIR /web
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM --platform=$BUILDPLATFORM debian:bullseye-slim AS chef
WORKDIR /app

# Update default packages
RUN apt-get update

# Get Ubuntu packages
RUN apt-get install -y \
    build-essential \
    curl

# Update new packages
RUN apt-get update

# Get Rust
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y

ENV PATH="/root/.cargo/bin:${PATH}"
RUN cargo install --locked --version 0.1.67 cargo-chef
RUN cargo install --locked --version 0.8.3 sqlx-cli --no-default-features --features rustls,sqlite
ENV DATABASE_URL=sqlite:///my-music-data/db
RUN mkdir -p /my-music-data
RUN sqlx database create
COPY migrations migrations
RUN sqlx migrate run

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder 
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies - this is the caching Docker layer!
RUN cargo chef cook --release --recipe-path recipe.json
# Build application
COPY migrations migrations
COPY src src
COPY Cargo.toml Cargo.toml
COPY Cargo.lock Cargo.lock
RUN cargo build --release

FROM --platform=$BUILDPLATFORM debian:bullseye-slim AS runtime
WORKDIR /
COPY --from=web-build /web/dist /my-music-web
COPY --from=builder /app/target/release/my-music /my-music
ENTRYPOINT ["/my-music"]
