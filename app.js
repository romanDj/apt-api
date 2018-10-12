var express = require("express");
var bodyParser = require("body-parser");
var escape = require("escape-html");
var db = require("./db");
var crypto = require('crypto');

var app = express();

/*Настройки*/
var port = 81;
const SALT = "danirJS"; //строка для соли

app.use("/img", express.static(__dirname + "/img"));
app.use(bodyParser.json()); //используем JSON 
app.use(bodyParser.urlencoded({
    extended: true
}));



//разрешаем доступ из нескольких мест
app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});



/*основа*/
app.get("/", function(req, res) {
    res.status(500).send("500 BAD REQUEST");
});


/*Авторизация*/
app.get("/authUser/:login/:pass", function(req, res) {
    var params = {
        login: req.params.login,
        pass: req.params.pass
    };

    userExits(params.login, params.pass, function(user) {
        if (user) {
            authUser(params.login, function(result) {
                res.json(result);
            });
        } else {
            res.json({
                "result": "false"
            });
        }

    });
});


//фопрос ответ
app.get("/getFaq/:skip/:take", function(req, res){
    var take = req.params.take;
    var skip = req.params.skip;

    db.query("SELECT * FROM `Questions` WHERE `idAnswers` > 0 ORDER by id desc LIMIT "+ skip +", " + take, function(err, rows, fields){
        if (err) return console.log(err);
        res.json(rows);
    });
});


//получение списка групп
app.get("/getGroups", function(req, res) {
    db.query("SELECT Id, Name FROM Groups", function(err, rows, fields) {
        if (err) return console.log(err);
        res.json(rows);
    });
});


//получение своего расписания по дате и группе
app.get("/getRasp/:group_id/:date", function(req, res) {
    var date = req.params.date;
    var group_id = req.params.group_id;
 

    db.query(`SELECT g.name, mr.Date, s.Name, s.Family, s.Father, sub.Name, mr.Pair, p.TimeStart, p.TimeEnd
			  	FROM MagazineRecords mr 
			  	left join Groups g on mr.idGroup = g.id
			  	left join Staffs s on mr.idTeacher = s.id		
			  	left join Subjects sub on mr.idSubject = sub.id
			  	left join Pair p on p.id =mr.Pair
			  WHERE Date = ? AND idGroup = ?`, [date, group_id], function(err, rows, fields) {
        var result = {
            info: `Информация группы ${rows.Name}`,
            subjects: rows
        };
        res.json(rows);
    })
});

//просмотр новостей //SELECT * FROM `News` WHERE  `Tip` = 'Новость' ORDER by `id` DESC LIMIT 0, 20
app.get("/getNews/:skip/:take", function(req, res){
    var take = req.params.take;
    var skip = req.params.skip;

    db.query("SELECT * FROM `News` WHERE  `Tip` = 'Новость' ORDER by `id` DESC LIMIT "+ skip +", " + take, function(err, rows, fields){
        if (err) return console.log(err);
        res.json(rows);
    });
});


app.get("/getNews/:idNews", function(req, res){
    var idNews = req.params.idNews; 

    db.query(`SELECT * FROM News WHERE id = ${idNews}`, function(err, rows, fields){
        res.json(rows);
    }); 
});



//получение оценок
//71ccfe54033c1f0671ac5596476ac6f4
app.get("/getMagazine/:login/:date/:hash", function(req, res) {
    var login = req.params.login;
    var date = req.params.date;
    var hash = req.params.hash;

    db.query(`SELECT da.Date, da.Pair, da.Assess, da.Inform, s.Name, concat(t.Name, ' ', t.Father) as FIO, 
							da.idStudent 
							FROM DaysAssess da 
							
							join Subjects s on da.idSubject = s.id 
							join Staffs t on t.id = da.idTeacher 
							join users u on u.UserId = da.idStudent
							
							where u.Login = ? AND da.Date = ? AND u.hash = ?`, [login, date, hash], function(err, rows, fields) {
        if (!isEmpty(rows)) {
            res.json(rows);
        } else {
            res.json({
                "error": "bad hash or null query"
            });
        }
    });
});

//сортировка по дисциплине
app.get("/getMagazine/:login/:date/:hash/order", function(req, res) {
    var login = req.params.login;
    var date = req.params.date;
    var hash = req.params.hash;

    db.query(`SELECT da.Date, da.Pair, da.Assess, da.Inform, s.Name, concat(t.Name, ' ', t.Father) as FIO, 
                            da.idStudent 
                            FROM DaysAssess da 
                            
                            join Subjects s on da.idSubject = s.id 
                            join Staffs t on t.id = da.idTeacher 
                            join users u on u.UserId = da.idStudent
                            
                            where u.Login = ? AND da.Date = ? AND u.hash = ? order by s.Name`, [login, date, hash], function(err, rows, fields) {
        if (!isEmpty(rows)) {
            res.json(rows);
        } else {
            res.json({
                "error": "bad hash or null query"
            });
        }
    });
});

/**/

app.get("/getDuty/:login", function(req, res) {
    var login = req.params.login;

    db.query("SELECT sd.id, sd.theme, sd.isClosed, s.Title FROM `sessionDuty` sd join Subjects s on sd.idSubject = s.id  join Users u on u.UserId = sd.idStudent WHERE u.Login = ?", [login], function(err, rows, fields){
        res.json(rows);
    });
});

app.get("/getDesc", function(req, res) {
    db.query("SELECT * FROM `AdDesk` order by id desc", function(err, rows, fields){
        res.json(rows);
    });
});

function GroupBy(myjson,attr){
    var sum ={};

    myjson.forEach( function(obj){
       if ( typeof sum[obj[attr]] == 'undefined') {
         sum[obj[attr]] = 1;
       }
       else {
         sum[obj[attr]]++;
       } 
    });
    return sum;
}


//получение СВОИХ оценок
app.get("/getMagazine/:login/:hash", function(req, res) {
    var login = req.params.login;
    var hash = req.params.hash;

    db.query(`SELECT da.Date, da.Pair, da.Assess, da.Inform, s.Name, concat(t.Name, ' ', t.Father) as FIO, 
                            da.idStudent 
                            FROM DaysAssess da 
                            
                            join Subjects s on da.idSubject = s.id 
                            join Staffs t on t.id = da.idTeacher 
                            join users u on u.UserId = da.idStudent
                            
                            where (u.Login = ? AND u.hash = ?) AND (da.Assess != 0)  AND (da.Assess != 9) order by da.Date desc`, [login, hash], function(err, rows, fields) {
        if (!isEmpty(rows)) {
            res.json(rows.reduce(function (r, a) {
                    //r.reverse();
                    r[a.Date] = r[a.Date] || [];
                    r[a.Date].push(a);
                    return r;
                }, Object.create(null)));
        } else {
            res.json({
                "error": "bad hash or null query"
            });
        }
    });
});


//авторизация
//RETURN OBJECT
function authUser(login, callback) {
    var hash = md5(login + SALT);

    db.query("UPDATE `Users` SET `hash`=? WHERE Login = ?", [hash, login], function(err, rows, fields) {
        callback({
            "result": "OK",
            "hash": hash
        });
    });
}


//проверка на существование юзера
function userExits(login, pass, callback) {
    db.query("SELECT * FROM `Users` WHERE Login = ? AND Pass = ?", [login, pass], function(err, rows, fields) {
        if (rows) {
            callback(rows[0]) //
        } else {
            callback();
        }
    });
}



function md5(string) {
    return crypto.createHash('md5').update(string).digest('hex');
}

function dateFormat(date) {
    return new Date(date).toISOString().replace(/T/, ' ').replace(/\..+/, ''); // delete the dot and everything after
}

function json_merge_recursive(json1, json2) {
    var out = {};
    for (var k1 in json1) {
        if (json1.hasOwnProperty(k1)) out[k1] = json1[k1];
    }
    for (var k2 in json2) {
        if (json2.hasOwnProperty(k2)) {
            if (!out.hasOwnProperty(k2)) out[k2] = json2[k2];
            else if (
                (typeof out[k2] === 'object') && (out[k2].constructor === Object) &&
                (typeof json2[k2] === 'object') && (json2[k2].constructor === Object)
            ) out[k2] = json_merge_recursive(out[k2], json2[k2]);
        }
    }
    return out;
}


Array.prototype.sumUnic = function(name, sumName){
    var returnArr = [];
    var obj = this;
    for(var x = 0; x<obj.length; x++){
        if((function(source){
            if(returnArr.length == 0){
                return true;
            }else{
                var isThere = [];
                for(var y = 0; y<returnArr.length; y++){
                    if(returnArr[y][name] == source[name]){
                        returnArr[y][sumName] = parseInt(returnArr[y][sumName]) + parseInt(source[sumName]);
                        return false;
                    }else{
                        isThere.push(source);
                    }
                }
                if(isThere.length>0)returnArr.push(source);
                return false;
            }
        })(obj[x])){
            returnArr.push(obj[x]);
        }
    }
    return returnArr;
}


function isEmpty(obj) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop))
            return false;
    }
    return true;
}

app.use(function(req, res, next) {
    res.status(404).send("404 NOT FOUND");
});



//запускаем
app.listen(port, "0.0.0.0", () => {
    console.log("ЗАПУЩЕНО НA " + port + " порту " + new Date());
});