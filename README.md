# my-music

Music for me.

## Local Dev

1. `mkdir my-music-data`
2. `sqlx database create`
3. `sqlx migrate run`
4. In web dir: `pnpm i && pnpm build && pnpm dev`
5. `cargo run`
6. go to https://localhost:5173 and login with "admin" and "password"

## Config

To deploy this, you need to at least set the following in config, other config options aren't required.

```json
{
    "listen_addr": "0.0.0.0:80",
    "domain": "https://example.org",
    "jwt_secret": "secretkey",
    "init_username": "username",
    "init_password": "password",
    "init_storage_backend": {
        // You can also use fs instead of s3
        "s3": {
            // These must be provided, or else presigning won't work correctly
            "access_key_id": "",
            "secret_access_key": "",
            "bucket": "bucket",
            "region": "us-west-1"
        }
    }
}
```

## Building

I'm using sqlite as the database so you might need it installed depending on your OS. I think rusqlite/libsqlite3-sys should compile from source for you though.
