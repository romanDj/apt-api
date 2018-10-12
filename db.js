var mysql = require("mysql");

var conn = mysql.createConnection({
    host: "localhost",
    user: "root",
	password: "",
	database: "apt",
});

conn.connect(function(err) {
    if (err) console.log("ERR");
});

module.exports = conn;