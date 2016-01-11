var async = require('async'),
    fs = require('fs'),
    gm = require('gm'),
    https = require('https'),
    mkdirp = require('mkdirp'),
    program = require('commander'),
    request = require('request');

program
  .version('0.0.1')
  .arguments('<username> <password> [output-dir]')
  .action(function (username, password, output_dir) {
     usernameValue = username;
     passwordValue = password;
     outputDirValue = output_dir;
  })
  .parse(process.argv);

if (typeof usernameValue === 'undefined') {
   program.outputHelp()
   process.exit(1);
}
if (typeof outputDirValue === 'undefined') {
   outputDirValue = usernameValue;
}

var IMAGES_DIR = outputDirValue + "/img";
var THUMBS_DIR = outputDirValue + "/thumb";
var WATERMARK_DIR = outputDirValue + "/preview";
var CONCURRENT_DOWNLOAD_LIMIT = 25;
var PREVIEW_THUMB_SIZE = 400; // size of preview images
var PREVIEW_FONT_SIZE = 70; // font size for the watermark

var findCookie = function(jar, url, cookieName) {
  var cookies = jar.getCookies(url);
  for (var i = 0; i < cookies.length; i++) {
    if (cookies[i].key == cookieName) {
      return cookies[i].value;
    }
  }
  return null;
}

var downloadFile = function(url, dest, cb) {
  // from http://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
  var file = fs.createWriteStream(dest);
  var request = https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);  // close() is async, call cb after close completes.
    });
  }).on('error', function(err) { // Handle errors
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
    if (cb) cb(err.message);
  });
};

var make_IG_request = function(jar) {
  return function(method, url, form_data, callback) {
    var opts = {
      method: method,
      url: url,
      jar: jar,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.86 Safari/537.36",
        "Referer": "https://www.instagram.com/",
      },
    };
    if (form_data) {
      if (method == "GET")
        opts.qs = form_data
      else {
        opts.headers["X-Instagram-AJAX"] = 1;
        opts.headers["X-Requested-With"] = "XMLHttpRequest";
        var csrftoken = findCookie(jar, url, "csrftoken");
        if (csrftoken) opts.headers["X-CSRFToken"] = csrftoken;
        opts.form = form_data;
      }
    }
    request(opts, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        callback(null, body);
      } else {
        if (error) {
          console.log(error);
          callback(error);
        } else {
          console.log(response.statusCode);
          callback("Status " + response.statusCode);
        }
      }
    });
  };
};

var IG_jar = request.jar();
var IG_request = make_IG_request(IG_jar);
var login = {
  username: usernameValue,
  password: passwordValue
}

async.series([
  function(cb) {mkdirp(IMAGES_DIR, cb);},
  function(cb) {mkdirp(THUMBS_DIR, cb);},
  function(cb) {mkdirp(WATERMARK_DIR, cb);},
  function(cb) {IG_request("GET", "https://instagram.com", null, cb);},
], function(err) {
  if (err) {
    console.log(err);
    return;
  }
  console.log("Logging into Instagram..");
  IG_request("POST", "https://www.instagram.com/accounts/login/ajax/", login, function(err, response) {
    login_result = JSON.parse(response);
    if (login_result.authenticated == false) {
      console.log("Error: Incorrect username/password");
    } else {
      userid = findCookie(IG_jar, "https://www.instagram.com/query/", "ds_user_id");
      console.log("Logged in successfully.");
      IG_request("GET", "https://www.instagram.com/" + usernameValue + "/", null, function(err, response) {
        var start_cursor = null;
        var has_next_page = true;
        var picture_urls = [];
        var isFirst = true;
        var numPictures = 0;

        var getPictures = function(callback) {
          var media_query = isFirst ? "media.first(1)" : "media.after(" + start_cursor + ", 12)";
          var query = {
            q: "ig_user(" + userid + ") { " + media_query + " {\n  count,\n  nodes {\n    caption,\n    code,\n    comments {\n      count\n    },\n    date,\n    dimensions {\n      height,\n      width\n    },\n    display_src,\n    id,\n    is_video,\n    likes {\n      count\n    },\n    owner {\n      id\n    },\n    thumbnail_src\n  },\n  page_info\n}\n }",
            ref: "users::show"
          };
          IG_request("POST", "https://www.instagram.com/query/", query, function(err, response) {
            if (err) {
              callback(err);
              return;
            }
            var query_result = JSON.parse(response);
            has_next_page = query_result.media.page_info.has_next_page;
            start_cursor = query_result.media.page_info.end_cursor;

            if (isFirst) {
              numPictures = query_result.media.count;
              console.log(numPictures + " pictures in account.");
            }
            var nodes = query_result.media.nodes;
            for (var i = 0; i < nodes.length; i++) {
              picture_urls.push({
                id: nodes[i].id,
                code: nodes[i].code,
                url: nodes[i].display_src,
                thumb: nodes[i].thumbnail_src
              })
            }

            var percDone = picture_urls.length * 100 / numPictures;
            if (numPictures > 0)
              console.log("Retrieved " + picture_urls.length + "/" + numPictures + " (" + percDone.toFixed(0) + "%)");
            isFirst = false;
            callback(null);
          });
        };

        async.whilst(
          function() { return has_next_page; },
          getPictures,
          function(err, results) {
            if (err) {
              console.log(err);
            } else {
              // download images
              console.log("Done. Downloading images..");

              var downloadImg = function(item, callback) {
                async.parallel([
                  function(cb) {downloadFile(item.url, IMAGES_DIR + "/" +  item.id + ".jpg", cb);},
                  function(cb) {downloadFile(item.url, THUMBS_DIR + "/" +  item.id + ".jpg", cb);},
                ], callback);
              };

              async.mapLimit(picture_urls, CONCURRENT_DOWNLOAD_LIMIT, downloadImg, function(err, results) {
                if (err) {
                  console.log(err);
                } else {
                  console.log("Successfully downloaded " + picture_urls.length + " images to " + outputDirValue + ".");
                  // watermark
                  var watermarkImg = function(item, callback) {
                    var thumbImg = THUMBS_DIR + "/" +  item.id + ".jpg";
                    var watermarkImg = WATERMARK_DIR + "/" +  item.id + ".jpg";
                    gm(thumbImg)
                    .resize(PREVIEW_THUMB_SIZE, PREVIEW_THUMB_SIZE)
                    .out("-draw", "font Arial font-size " + PREVIEW_FONT_SIZE + " gravity center fill Black rotate -45 text 0,0 \"PREVIEW\"")
                    .write(watermarkImg, function(err) {
                      if (err) callback(err);
                      else {
                        // delete thumb image
                        fs.unlink(thumbImg, callback);
                      }
                    });
                  };

                  async.mapLimit(picture_urls, CONCURRENT_DOWNLOAD_LIMIT, watermarkImg, function(err, results) {
                    if (err) {
                      console.log("Error: " + err.message);
                    } else {
                      console.log("Successfully watermarked images to " + WATERMARK_DIR + ".");
                      fs.rmdirSync(THUMBS_DIR);
                    }
                  });
                }
              });
            }
          }
        );
      });
    }
  });
});
