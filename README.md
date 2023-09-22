# DIP Bot

DIP Bot helps design teams share work in progress

## Setup

DIP Bot consists of 3 pieces: an S3 Bucket to store images, a Postgres Database to store post metadata, and a Slack integration to cross-post to your Slack workspace. Once these are set up, create a `.env` file with the following variables and the server should be ready for use.

#### AWS
`AWS_ACCESS_KEY`
`AWS_BUCKET_NAME`
`AWS_BUCKET_PATH`
`AWS_SECRET_KEY`

#### Postgres
`CONNECTION_STRING`
`TABLE_NAME`

#### Slack
`SLACK_CHANNEL`
`SLACK_SECRET`
`SLACK_TOKEN`
