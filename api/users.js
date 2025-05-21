const mysql = require('mysql2/promise');
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');

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

exports.router = router;

/*
 * Route to list all of a user's businesses.
 */
router.get('/:userid/businesses', async function (req, res) {
  const userid = parseInt(req.params.userid);
  const userBusinesses = await mysqlPool.query(`SELECT * FROM businesses WHERE ownerid = ${userid}`);
  res.status(200).json({
    businesses: userBusinesses
  });
});

/*
 * Route to list all of a user's reviews.
 */
router.get('/:userid/reviews', async function (req, res) {
  const userid = parseInt(req.params.userid);
  const userReviews = await mysqlPool.query(`SELECT * FROM reviews WHERE userid = ${userid}`);
  res.status(200).json({
    reviews: userReviews
  });
});

/*
 * Route to list all of a user's photos.
 */
router.get('/:userid/photos', async function (req, res) {
  const userid = parseInt(req.params.userid);
  const userPhotos = await mysqlPool.query(`SELECT * FROM photos WHERE userid = ${userid}`);
  res.status(200).json({
    photos: userPhotos
  });
});

/*
 * Route to create a new user.
 */

/*
 * Schema describing required/optional fields of a business object. adapted from businesses
 */
const userSchema = {
  name: { required: true },
  email: { required: true },
  password: { required: true },
  admin: { required: false },
};

router.post('/', async function (req, res) {
  if(validateAgainstSchema(req.body, userSchema)){
    const user = extractValidFields(req.body, userSchema);
    const [users] = await mysqlPool.query('SELECT * FROM users WHERE email = ?', [user.email]);
    user.id = users.length
    let query = `INSERT INTO users (name, email, password, admin) VALUES (${user.name}, ${user.email}, ${user.password}, ${user.admin ?? false})`;
    await mysqlPool.query(query);
    res.status(201).json({
      id: business.id,
      links: {
        users: `/users/${user.id}`
      }
    });
  } else {
    res.status(400).json({
      error: "Request body is not a valid user object"
    });
  }
})

router.get('/:userid', async function (req, res, next) {
  const userid = parseInt(req.params.userid);
  const user_raw = await mysqlPool.query(`select * FROM users where id = ${userid}`);
  if (user_raw[0].length==1) {
    /*
     * Find all reviews and photos for the specified user and create a
     * new object containing all of the user data, including reviews and
     * photos
     */
    const photos = await mysqlPool.query(`select * FROM photos where userid = ${userid}`);
    const reviews = await mysqlPool.query(`select * FROM reviews where userid = ${userid}`);
    const businesses = await mysqlPool.query(`select * FROM businesses where ownerid = ${userid}`);
    const user = {
      businesses: businesses,
      reviews: reviews,
      photos: photos
    };
    Object.assign(user, user_raw[0][0]);
    delete user.password;
    res.status(200).json(user);
  } else {
    next();
  }
})