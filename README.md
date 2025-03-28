# DuckCross API

## Database Options

This project makes use of the Prisma ORM. Prisma supports a variety of
different database options. By default, Postgres is used, but for development
purposes this can be changed to anything else. For local development and
testing, I would recommend using SQLite since it allows the database to be
stored locally in a file, which is much simpler for development.

To do this, first make a backup of the original `primsa/schema.prisma` file.
Then, change the following lines
