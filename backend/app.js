const express = require("express");
const cors = require("cors");
const { App } = require("@slack/bolt");
const dotenv = require("dotenv");
const app = express();
const port = process.env.PORT || 3000;
const fs = require("fs");
const AWS = require("aws-sdk");
const { Pool } = require("pg");

dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});

const bucketName = process.env.AWS_BUCKET_NAME;
const bucketPath = process.env.AWS_BUCKET_PATH;
const connectionString = process.env.CONNECTION_STRING;
const tableName = process.env.TABLE_NAME;

// Set up Slack integration
const slackApp = new App({
  token: process.env.SLACK_TOKEN,
  signingSecret: process.env.SLACK_SECRET,
});

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.listen(port, () => {
  (async () => {
    await slackApp.start(8000);
    console.log("Bolt app is running!");
  })();
});

const padZero = (number) => {
  return number.toString().padStart(2, "0");
};

const getDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = padZero(now.getMonth() + 1);
  const day = padZero(now.getDate());
  const hours = padZero(now.getHours());
  const minutes = padZero(now.getMinutes());
  const seconds = padZero(now.getSeconds());
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const createDescriptionText = (name, description) => {
  return description ? `*${name}*: ${description}` : `*${name}*`;
};

const uploadImage = async (name, imageData, index) => {
  const path = `images/${name
    .toLowerCase()
    .replace(/\s+/g, "")}_${getDateTimeString()}_${index}.png`;

  fs.writeFileSync(path, imageData, "base64", (err) => {
    console.log(err);
  });

  return await slackApp.client.files.upload({
    filename: "image.png",
    file: fs.createReadStream(path),
  });
};

app.post("/share", async (req, res) => {
  const { name, imageData, description, url, public } = req.body;

  if (!fs.existsSync("images")) {
    fs.mkdirSync("images");
  }

  if (public) {
    // Slack upload
    const permalinks = await Promise.all(
      imageData.map(async (imageURL, index) => {
        return (await uploadImage(name, imageURL, index)).file.permalink;
      })
    );

    const images = permalinks.map((permalink) => `<${permalink}| >`).join("");
    const message = `${createDescriptionText(name, description)} ${images}`;

    const slackMessage = {
      text: message,
      channel: process.env.SLACK_CHANNEL,
    };

    if (url) {
      // if it contains a URL, add Open in Figma block
      slackMessage.blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: message,
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open in Figma",
            },
            url: url,
            action_id: "button_click",
          },
        },
      ];
    }

    await slackApp.client.chat.postMessage(slackMessage);
  }

  // RetoolDB / AWS upload
  const pool = new Pool({
    connectionString,
  });

  try {
    // Iterate over images array and upload each image to S3
    const s3Urls = await Promise.all(
      imageData.map(async (image, index) => {
        const path = `images/${name
          .toLowerCase()
          .replace(/\s+/g, "")}_${getDateTimeString()}_${index}.png`;

        fs.writeFileSync(path, image, "base64", (err) => {
          console.log(err);
        });

        const blob = fs.readFileSync(path);

        const params = { Bucket: bucketName, Key: path, Body: blob };
        await s3.upload(params).promise();
        return `${bucketPath}/${path}`;
      })
    );

    // Insert new entry into PostgreSQL database
    await pool.query(
      `INSERT INTO ${tableName} (name, description, images, figma, public) VALUES ($1, $2, $3, $4, $5)`,
      [name, description, JSON.stringify(s3Urls), url, public]
    );

    fs.rm("images", { recursive: true }, (err) => {
      if (err) {
        throw err;
      }
    });

    res.json({ status: "success" });
  } catch (err) {
    console.error(err);
    res.json({ status: "error" });
  } finally {
    // Release PostgreSQL connection
    pool.end();
  }
});
