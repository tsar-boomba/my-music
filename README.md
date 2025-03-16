# my-music

Music for me

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
            "bucket": "bucket",
            "region": "us-west-1"
        }
    }
}
```

## Building

I'm using sqlite as the database so you might need it installed depending on your OS. I think rusqlite/libsqlite3-sys should compile from source for you though.
