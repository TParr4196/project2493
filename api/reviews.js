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
 * Schema describing required/optional fields of a review object.
 */
const reviewSchema = {
  userid: { required: true },
  businessid: { required: true },
  dollars: { required: true },
  stars: { required: true },
  review: { required: false }
};


/*
 * Route to create a new review.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, reviewSchema)) {

    const review = extractValidFields(req.body, reviewSchema);

    /*
     * Make sure the user is not trying to review the same business twice.
     */
    const userReviewedThisBusinessAlready = await mysqlPool.query(`select * FROM reviews where userid = ${review.userid} and businessid = ${review.businessid}`);

    if (userReviewedThisBusinessAlready[0].length > 0) {
      res.status(403).json({
        error: "User has already posted a review of this business"
      });
    } else {
      let query = `insert into reviews (userid, businessid, dollars, stars, review) values\n`;
      query += `("${review.userid}", "${review.businessid}", "${review.dollars}", "${review.stars}", "${review.review ?? ""}");`;
      await mysqlPool.query(query);
      res.status(201).json({
        id: review.id,
        links: {
          review: `/reviews/${review.id}`,
          business: `/businesses/${review.businessid}`
        }
      });
    }

  } else {
    res.status(400).json({
      error: "Request body is not a valid review object"
    });
  }
});

/*
 * Route to fetch info about a specific review.
 */
router.get('/:reviewID', async function (req, res, next) {
  const reviewID = parseInt(req.params.reviewID);
  const review_raw = await mysqlPool.query(`select * FROM reviews where id = ${reviewID}`);
  if (review_raw[0].length == 1) {
    const review = {};
    Object.assign(review, review_raw[0]);
    res.status(200).json(review);
  } else {
    next();
  }
});

/*
 * Route to update a review.
 */
router.put('/:reviewID', async function (req, res, next) {
  const reviewID = parseInt(req.params.reviewID);
  const review_raw = await mysqlPool.query(`select * FROM reviews where id = ${reviewID}`);
  if (review_raw[0].length == 1) {
    if (validateAgainstSchema(req.body, reviewSchema)) {
      /*
       * Make sure the updated review has the same businessid and userid as
       * the existing review.
       */
      let updatedReview = extractValidFields(req.body, reviewSchema);
      let existingReview = review_raw[0][0] ?? {};
      if (updatedReview.businessid === existingReview.businessid && updatedReview.userid === existingReview.userid) {
        let query = `update reviews set id = ${reviewID}, userid = ${updatedReview.userid}, businessid = ${updatedReview.businessid}, dollars = ${updatedReview.dollars}, stars = ${updatedReview.stars}, review = "${updatedReview.caption ?? ""}" where id = ${reviewID};`
        await mysqlPool.query(query);
        res.status(200).json({
          links: {
            review: `/reviews/${reviewID}`,
            business: `/businesses/${updatedReview.businessid}`
          }
        });
      } else {
        res.status(403).json({
          error: "Updated review cannot modify businessid or userid"
        });
      }
    } else {
      res.status(400).json({
        error: "Request body is not a valid review object"
      });
    }

  } else {
    next();
  }
});

/*
 * Route to delete a review.
 */
router.delete('/:reviewID', async function (req, res, next) {
  const reviewID = parseInt(req.params.reviewID);
  const review_raw = await mysqlPool.query(`select * FROM reviews where id = ${reviewID}`);
  if (review_raw[0].length==1) {
    const success = await mysqlPool.query(`delete from reviews where id = ${reviewID}`);
    res.status(204).end();
  } else {
    next();
  }
});
