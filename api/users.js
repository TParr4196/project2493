require('dotenv').config()
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken')
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

//adapted from challenge 6-1
function requireAuthentication(req, res, next){
    try {
        const auth_value = req.get('Authorization');
        const token = auth_value.split("[")[1].split("]")[0];
        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
        // if we get here, success
        req.userid=payload.userid;
        req.admin=payload.admin;
        next();
    } catch(err) {
        res.status(401).send(401);
        // this means we failed
    }
}

function checkAdmin(req, res, next) {
  try {
        const auth_value = req.get('Authorization');
        const token = auth_value.split("[")[1].split("]")[0];
        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
        // if we get here, success
        req.userid=payload.userid;
        req.admin=payload.admin;
        next();
    } catch(err) {
        req.userid=-1;
        req.admin=false;
        // this means we failed
    }
}

exports.router = router;

/*
 * Route to list all of a user's businesses.
 */
router.get('/:userid/businesses', requireAuthentication, async function (req, res) {
  const userid = parseInt(req.params.userid);
  if (userid!=req.userid && !req.admin){
    return res.status(403).send("unauthorized userid");
  }
  const userBusinesses = await mysqlPool.query(`SELECT * FROM businesses WHERE ownerid = ${userid}`);
  res.status(200).json({
    businesses: userBusinesses
  });
});

/*
 * Route to list all of a user's reviews.
 */
router.get('/:userid/reviews', requireAuthentication, async function (req, res) {
  const userid = parseInt(req.params.userid);
  if (userid!=req.userid && !req.admin){
    return res.status(403).send("unauthorized userid");
  }
  const userReviews = await mysqlPool.query(`SELECT * FROM reviews WHERE userid = ${userid}`);
  res.status(200).json({
    reviews: userReviews
  });
});

/*
 * Route to list all of a user's photos.
 */
router.get('/:userid/photos', requireAuthentication, async function (req, res) {
  const userid = parseInt(req.params.userid);
  if (userid!=req.userid && !req.admin){
    return res.status(403).send("unauthorized userid");
  }
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

router.post('/', checkAdmin, async function (req, res) {
  if(validateAgainstSchema(req.body, userSchema)){
    const user = extractValidFields(req.body, userSchema);
    const [users] = await mysqlPool.query('SELECT * FROM users WHERE email = ?', [user.email]);
    user.id = users.length
    if(user.admin&&!req.admin){
      return res.status(403).send("must be an admin to create and admin account");
    }
    let query = `INSERT INTO users (name, email, password, admin) VALUES (${user.name}, ${user.email}, ${await bcrypt.hash(user.password, 8)}, ${user.admin ?? false})`;
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

router.get('/:userid', requireAuthentication, async function (req, res, next) {
  const userid = parseInt(req.params.userid);
  if (userid!=req.userid && !req.admin){
    return res.status(403).send("unauthorized userid");
  }
  const user_raw = await mysqlPool.query(`select * FROM users where id = ${userid}`);
  if (user_raw[0].length==1) {
    /*
     * Find all reviews and photos for the specified user and create a
     * new object containing all of the user data, including reviews and
     * photos
     */
    const [photos] = await mysqlPool.query(`select * FROM photos where userid = ${userid}`);
    const [reviews] = await mysqlPool.query(`select * FROM reviews where userid = ${userid}`);
    const [businesses] = await mysqlPool.query(`select * FROM businesses where ownerid = ${userid}`);
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

//adapted from challenge 6-1
router.post('/login', async function (req, res, next) {
  const user_raw = await mysqlPool.query(`select * FROM users where email = '${req.body.email}'`);
  let correct = false;
  if (user_raw[0].length == 1) {
    const user = user_raw[0][0];
    correct = await bcrypt.compare(req.body.password, user.password);
    if (correct) {
      payload = { 
        "userid": user.id,
        "admin": user.admin
       };
      const expiration = { "expiresIn": "24h" };
      const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, expiration);
      const final_token = "eyJhbGciOiJIUzI1NiIsIrI[" + token + "]ffdpiFjzYHaDADmhuV68";
      res.status(200).send({ "status": "ok", "token": final_token });
    } else {
      res.status(403).send({ "status": "invalid login" });
    }
  } else {
    next();
  }
})