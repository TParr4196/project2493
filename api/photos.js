"use strict";
require('dotenv').config();
const mysql = require('mysql2/promise');
const mysql_host = process.env.MYSQL_HOST || 'localhost';
const mysql_port = process.env.MYSQL_PORT || '3306';
const mysql_db = process.env.MYSQL_DB || 'mysqldb';
const mysql_user = process.env.MYSQL_USER || 'mysqluser';
const mysql_password = process.env.MYSQL_PASSWORD;

const mysqlPool = mysql.createPool({
  connectionLimit: 10,
  host: mysql_host,
  port: mysql_port,
  database: mysql_db,
  user: mysql_user,
  password: mysql_password
});

const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');

exports.router = router;

/*
 * Schema describing required/optional fields of a photo object.
 */
const photoSchema = {
  userid: { required: true },
  businessid: { required: true },
  caption: { required: false }
};


/*
 * Route to create a new photo.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, photoSchema)) {
    const photo = extractValidFields(req.body, photoSchema);
    const [photos] = await mysqlPool.query(`select * FROM photos`);
    photo.id = photos.length;
    let query = `insert into photos (userid, businessid, caption) values\n`;
    query += `("${photo.userid}", "${photo.businessid}", "${photo.caption ?? ""}");`;
    await mysqlPool.query(query);
    res.status(201).json({
      id: photo.id,
      links: {
        photo: `/photos/${photo.id}`,
        business: `/businesses/${photo.businessid}`
      }
    });
  } else {
    res.status(400).json({
      error: "Request body is not a valid photo object"
    });
  }
});

/*
 * Route to fetch info about a specific photo.
 */
router.get('/:photoID', async function (req, res, next) {
  const photoID = parseInt(req.params.photoID);
  const photo_raw = await mysqlPool.query(`select * FROM photos where id = ${photoID}`);
  if (photo_raw[0].length == 1) {
    const photo = {};
    Object.assign(photo, photo_raw[0]);
    res.status(200).json(photo);
  } else {
    next();
  }
});

/*
 * Route to update a photo.
 */
router.put('/:photoID', async function (req, res, next) {
  const photoID = parseInt(req.params.photoID);
  const photo_raw = await mysqlPool.query(`select * FROM photos where id = ${photoID}`);
  if (photo_raw[0].length == 1) {
    if (validateAgainstSchema(req.body, photoSchema)) {
      /*
       * Make sure the updated photo has the same businessid and userid as
       * the existing photo.
       */
      const updatedPhoto = extractValidFields(req.body, photoSchema);
      const existingPhoto = photo_raw[0][0] ?? {};
      if (existingPhoto && updatedPhoto.businessid === existingPhoto.businessid && updatedPhoto.userid === existingPhoto.userid) {
        let query = `update photos set id = ${photoID}, userid = ${updatedPhoto.userid}, businessid = ${updatedPhoto.businessid}, caption = "${updatedPhoto.caption ?? ""}" where id = ${photoID};`
        await mysqlPool.query(query);
        res.status(200).json({
          links: {
            photo: `/photos/${photoID}`,
            business: `/businesses/${updatedPhoto.businessid}`
          }
        });
      } else {
        res.status(403).json({
          error: "Updated photo cannot modify businessid or userid"
        });
      }
    } else {
      res.status(400).json({
        error: "Request body is not a valid photo object"
      });
    }

  } else {
    next();
  }
});

/*
 * Route to delete a photo.
 */
router.delete('/:photoID', async function (req, res, next) {
  const photoID = parseInt(req.params.photoID);
  const photo_raw = await mysqlPool.query(`select * FROM photos where id = ${photoID}`);
  if (photo_raw[0].length==1) {
    const success = await mysqlPool.query(`delete from photos where id = ${photoID}`);
    res.status(204).end();
  } else {
    next();
  }
});
