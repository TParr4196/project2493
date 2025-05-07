// Adapted from activity 4-2
const mysql = require('mysql2/promise');

const mysql_host = process.env.MYSQL_HOST || 'localhost';
const mysql_port = process.env.MYSQL_PORT || '3306';
const mysql_db = process.env.MYSQL_DB || 'messagesdb';
const mysql_user = process.env.MYSQL_USER || 'messagesuser';
const mysql_password = process.env.MYSQL_PASSWORD;

const mysqlPool = mysql.createPool({
  connectionLimit: 10,
  host: mysql_host,
  port: mysql_port,
  database: mysql_db,
  user: mysql_user,
  password: mysql_password
});

async function init_db() {
  await mysqlPool.query("drop table if exists photo");
  await mysqlPool.query("drop table if exists review");
  await mysqlPool.query("drop table if exists businesses");
  await mysqlPool.query("drop table if exists error");

  //https://www.w3schools.com/sql/sql_create_table.asp used to help with datatype syntax on 5/7/25
  await mysqlPool.query(`create table businesses (
      id integer primary key auto_increment,
      ownerid int NOT NULL,
      name varchar(255) NOT NULL,
      address varchar(255) NOT NULL,
      city varchar(255) NOT NULL,
      state varchar(255) NOT NULL,
      zip varchar(255) NOT NULL,
      phone varchar(255) NOT NULL,
      category varchar(255) NOT NULL,
      subcategory varchar(255) NOT NULL,
      website varchar(255),
      email varchar(255),
  )`);
  //https://www.w3schools.com/sql/sql_foreignkey.asp for help with foreign key syntax
  await mysqlPool.query(`create table photos (
    id integer primary key auto_increment,
    userid int NOT NULL,
    foreign key(businessid) REFERENCES businesses(id) NOT NULL,
    caption varchar(255),
  )`);
  await mysqlPool.query(`create table review (
    id integer primary key auto_increment,
    userid int NOT NULL,
    foreign key(businessid) REFERENCES businesses(id) NOT NULL,
    dollars int NOT NULL,
    stars int NOT NULL,
    review varchar(255),
  )`);
  await mysqlPool.query(`create table errors (
    id integer primary key auto_increment,
    error varchar(255),
  )`);
}

init_db();

const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');

const businesses = require('../data/businesses');
const { reviews } = require('./reviews');
const { photos } = require('./photos');

exports.router = router;
exports.businesses = businesses;

/*
 * Schema describing required/optional fields of a business object.
 */
const businessSchema = {
  ownerid: { required: true },
  name: { required: true },
  address: { required: true },
  city: { required: true },
  state: { required: true },
  zip: { required: true },
  phone: { required: true },
  category: { required: true },
  subcategory: { required: true },
  website: { required: false },
  email: { required: false }
};

/*
 * Route to return a list of businesses.
 */
router.get('/', function (req, res) {

  /*
   * Compute page number based on optional query string parameter `page`.
   * Make sure page is within allowed bounds.
   */
  let page = parseInt(req.query.page) || 1;
  const numPerPage = 10;
  const lastPage = Math.ceil(businesses.length / numPerPage);
  page = page > lastPage ? lastPage : page;
  page = page < 1 ? 1 : page;

  /*
   * Calculate starting and ending indices of businesses on requested page and
   * slice out the corresponsing sub-array of busibesses.
   */
  const start = (page - 1) * numPerPage;
  const end = start + numPerPage;
  const pageBusinesses = businesses.slice(start, end);

  /*
   * Generate HATEOAS links for surrounding pages.
   */
  const links = {};
  if (page < lastPage) {
    links.nextPage = `/businesses?page=${page + 1}`;
    links.lastPage = `/businesses?page=${lastPage}`;
  }
  if (page > 1) {
    links.prevPage = `/businesses?page=${page - 1}`;
    links.firstPage = '/businesses?page=1';
  }

  /*
   * Construct and send response.
   */
  res.status(200).json({
    businesses: pageBusinesses,
    pageNumber: page,
    totalPages: lastPage,
    pageSize: numPerPage,
    totalCount: businesses.length,
    links: links
  });

});

/*
 * Route to create a new business.
 */
router.post('/', function (req, res, next) {
  if (validateAgainstSchema(req.body, businessSchema)) {
    const business = extractValidFields(req.body, businessSchema);
    business.id = businesses.length;
    businesses.push(business);
    res.status(201).json({
      id: business.id,
      links: {
        business: `/businesses/${business.id}`
      }
    });
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object"
    });
  }
});

/*
 * Route to fetch info about a specific business.
 */
router.get('/:businessid', function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  if (businesses[businessid]) {
    /*
     * Find all reviews and photos for the specified business and create a
     * new object containing all of the business data, including reviews and
     * photos.
     */
    const business = {
      reviews: reviews.filter(review => review && review.businessid === businessid),
      photos: photos.filter(photo => photo && photo.businessid === businessid)
    };
    Object.assign(business, businesses[businessid]);
    res.status(200).json(business);
  } else {
    next();
  }
});

/*
 * Route to replace data for a business.
 */
router.put('/:businessid', function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  if (businesses[businessid]) {

    if (validateAgainstSchema(req.body, businessSchema)) {
      businesses[businessid] = extractValidFields(req.body, businessSchema);
      businesses[businessid].id = businessid;
      res.status(200).json({
        links: {
          business: `/businesses/${businessid}`
        }
      });
    } else {
      res.status(400).json({
        error: "Request body is not a valid business object"
      });
    }

  } else {
    next();
  }
});

/*
 * Route to delete a business.
 */
router.delete('/:businessid', function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  if (businesses[businessid]) {
    businesses[businessid] = null;
    res.status(204).end();
  } else {
    next();
  }
});
