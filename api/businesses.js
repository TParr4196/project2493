// Adapted from activity 4-2
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

const business_data = require('../data/businesses');
const photo_data = require('../data/photos');
const review_data = require('../data/reviews');
const user_data = require('../data/users');

async function init_db() {
  await mysqlPool.query("drop table if exists photos");
  await mysqlPool.query("drop table if exists reviews");
  await mysqlPool.query("drop table if exists businesses");
  await mysqlPool.query("drop table if exists errors");
  await mysqlPool.query("drop table if exists users");

  //https://www.w3schools.com/sql/sql_create_table.asp used to help with datatype syntax on 5/7/25
  await mysqlPool.query(`create table businesses (
      id integer primary key auto_increment,
      ownerid int not null,
      name varchar(255) not null,
      address varchar(255) not null,
      city varchar(255) not null,
      state varchar(255) not null,
      zip varchar(255) not null,
      phone varchar(255) not null,
      category varchar(255) not null,
      subcategory varchar(255) not null,
      website varchar(255),
      email varchar(255)
  );`);
  //https://www.w3schools.com/sql/sql_foreignkey.asp for help with foreign key syntax
  await mysqlPool.query(`create table photos (
    id integer primary key auto_increment,
    userid int not null,
    businessid int not null,
    FOREIGN KEY (businessid) REFERENCES businesses(id),
    caption varchar(255)
  );`);
  await mysqlPool.query(`create table reviews (
    id integer primary key auto_increment,
    userid int not null,
    businessid int not null,
    foreign key(businessid) REFERENCES businesses(id),
    dollars int not null,
    stars int not null,
    review varchar(255)
  );`);
  await mysqlPool.query(`create table errors (
    id integer primary key auto_increment,
    error varchar(255)
  );`);
  await mysqlPool.query(`create table users (
    id integer primary key auto_increment,
    name varchar(255) not null,
    email varchar(255) not null unique,
    password varchar(255) not null,
    admin boolean
  );`);

  //got help from chatgpt with grammar like missing quotes on insert queries
  let query = `insert into businesses (id, ownerid, name, address, city, state, zip, phone, category, subcategory, website, email) values\n`
  for (let i = 0; i<business_data.length-1; i++){
    query+=`(${business_data[i].id}, ${business_data[i].ownerid}, "${business_data[i].name}", "${business_data[i].address}", "${business_data[i].city}", "${business_data[i].state}", "${business_data[i].zip}", "${business_data[i].phone}", "${business_data[i].category}", "${business_data[i].subcategory}", "${business_data[i].website ?? ""}", "${business_data[i].email ?? ""}"),\n`
  }
  query+=`(${business_data[business_data.length-1].id}, ${business_data[business_data.length-1].ownerid}, "${business_data[business_data.length-1].name}", "${business_data[business_data.length-1].address}", "${business_data[business_data.length-1].city}", "${business_data[business_data.length-1].state}", "${business_data[business_data.length-1].zip}", "${business_data[business_data.length-1].phone}", "${business_data[business_data.length-1].category}", "${business_data[business_data.length-1].subcategory}", "${business_data[business_data.length-1].website ?? ""}", "${business_data[business_data.length-1].email ?? ""}");`
  await mysqlPool.query(query);

  //photos
  query = `insert into photos (id, userid, businessid, caption) values\n`
  for (let i = 0; i<photo_data.length-1; i++){
    query+=`(${photo_data[i].id}, ${photo_data[i].userid}, ${photo_data[i].businessid}, "${photo_data[i].caption ?? ""}"),\n`
  }
  query+=`(${photo_data[photo_data.length-1].id}, ${photo_data[photo_data.length-1].userid}, ${photo_data[photo_data.length-1].businessid}, "${photo_data[photo_data.length-1].caption ?? ""}");`
  await mysqlPool.query(query);

  //reviews
  query = `insert into reviews (id, userid, businessid, dollars, stars, review) values\n`
  for (let i = 0; i<review_data.length-1; i++){
    query+=`(${review_data[i].id}, ${review_data[i].userid}, ${review_data[i].businessid}, ${review_data[i].dollars}, ${review_data[i].stars}, "${review_data[i].review ?? ""}"),\n`
  }
  query+=`(${review_data[review_data.length-1].id}, ${review_data[review_data.length-1].userid}, ${review_data[review_data.length-1].businessid}, "${review_data[review_data.length-1].dollars}", "${review_data[review_data.length-1].stars}", "${business_data[business_data.length-1].review ?? ""}");`
  await mysqlPool.query(query);

  //users
  query = `insert into users (name, email, password, admin) values\n`
  for (let i = 0; i<user_data.length-1; i++){
    query+=`("${user_data[i].name}", "${user_data[i].email}", "${user_data[i].password}", ${user_data[i].admin ?? false}),\n`
  }
  query+=`("${user_data[user_data.length-1].name}", "${user_data[user_data.length-1].email}", "${user_data[user_data.length-1].password}", ${true});`
  await mysqlPool.query(query);
}

init_db();

const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');

exports.router = router;

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
router.get('/', async function (req, res) {

  /*
   * Compute page number based on optional query string parameter `page`.
   * Make sure page is within allowed bounds.
   */
  let page = parseInt(req.query.page) || 1;
  const numPerPage = 10;
  const [businesses_raw] = await mysqlPool.query(`select * FROM businesses`);
  let businesses = businesses_raw["businesses"]
  if (!businesses){
    businesses=[];
  }
  const lastPage = Math.ceil(businesses.length / numPerPage);
  page = page > lastPage ? lastPage : page;
  page = page < 1 ? 1 : page;

  /*
   * Calculate starting and ending indices of businesses on requested page and
   * slice out the corresponsing sub-array of businesses.
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
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, businessSchema)) {
    const business = extractValidFields(req.body, businessSchema);
    const [businesses] = await mysqlPool.query(`select * FROM businesses`);
    business.id = businesses.length;
    let query = `insert into businesses (ownerid, name, address, city, state, zip, phone, category, subcategory, website, email) values\n`
    query+=`(${business.ownerid}, "${business.name}", "${business.address}", "${business.city}", "${business.state}", "${business.zip}", "${business.phone}", "${business.category}", "${business.subcategory}", "${business.website ?? ""}", "${business.email ?? ""}");`
    await mysqlPool.query(query);
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
})

/*
 * Route to fetch info about a specific business.
 */
router.get('/:businessid', async function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  const business_raw = await mysqlPool.query(`select * FROM businesses where id = ${businessid}`);
  if (business_raw[0].length==1) {
    /*
     * Find all reviews and photos for the specified business and create a
     * new object containing all of the business data, including reviews and
     * photos
     */
    const photos = await mysqlPool.query(`select * FROM photos where businessid = ${businessid}`);
    const reviews = await mysqlPool.query(`select * FROM reviews where businessid = ${businessid}`);
    const business = {
      reviews: reviews,
      photos: photos
    };
    Object.assign(business, business_raw[0][0]);
    res.status(200).json(business);
  } else {
    next();
  }
});

/*
 * Route to replace data for a business.
 */
router.put('/:businessid', async function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  const business_raw = await mysqlPool.query(`select * FROM businesses where id = ${businessid}`);
  if (business_raw[0].length==1) {
    let newBusiness = business_raw[0][0]
    if (validateAgainstSchema(req.body, businessSchema)) {
      newBusiness = extractValidFields(req.body, businessSchema);
      newBusiness.id = businessid;
      //https://www.w3schools.com/sql/sql_update.asp used for update syntax
      const success = await mysqlPool.query(`update businesses
set id=${businessid}, ownerid=${newBusiness.ownerid}, name="${newBusiness.name}", address="${newBusiness.address}", city="${newBusiness.city}", state="${newBusiness.state}", zip="${newBusiness.zip}", phone="${newBusiness.phone}", category="${newBusiness.category}", subcategory="${newBusiness.subcategory}", website="${newBusiness.website ?? ""}", email="${newBusiness.email ?? ""}"
where id = ${businessid};`)
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
router.delete('/:businessid', async function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  const business_raw = await mysqlPool.query(`select * FROM businesses where id = ${businessid}`);
  if (business_raw[0].length==1) {
    const success = await mysqlPool.query(`delete from businesses where id = ${businessid}`);
    res.status(204).end();
  } else {
    next();
  }
});
