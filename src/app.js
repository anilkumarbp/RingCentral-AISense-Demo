require('dotenv').config();
var https = require('https');
var express = require('express');
var unirest = require('unirest');
var FormData = require('form-data');
var fs = require('fs');
var request = require('request');

var app = express();

// Configure View and Handlebars
app.set('views', __dirname + '/views');
var exphbs = require('express-handlebars');
var hbs = exphbs.create({});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

// Create body parsers for application/json and application/x-www-form-urlencoded
var bodyParser = require('body-parser')
app.use(bodyParser.json())
var urlencodedParser = bodyParser.urlencoded({ extended: false })

var ringcentral = require('ringcentral');

var useTls = process.env.MY_APP_TLS_ENABLED > 0 ? true : false;
var server = null;
var sessionId = null;
var port = process.env.MY_APP_PORT;

var subscribed = false;

if (useTls) {
    var tls = require('tls'),
        fs = require('fs');
    server = https.createServer({
        key: fs.readFileSync(process.env.MY_APP_TLS_PRIVATE_KEY),
        cert: fs.readFileSync(process.env.MY_APP_TLS_PUBLIC_CERT)
    }, app).listen(port, function() {
        console.log('LISTEN_HTTPS ' + port);
    });
} else if (! useTls) {
    server = require('http').Server(app);
    server.listen(port, function() {
        console.log('LISTEN_HTTP ' + port);
    });
}

var rcsdk = new ringcentral({
    server: process.env.RC_APP_SERVER_URL,
    appKey: process.env.RC_APP_KEY,
    appSecret: process.env.RC_APP_SECRET
});

app.get('/', function(req, res) {
    // Get token for display after OAuth
    token = rcsdk.platform().auth().data();
    token_json = token['access_token'] ? JSON.stringify(token, null, ' ') : '';

    // Render home page with params
    res.render('index', {
        authorize_uri: rcsdk.platform().authUrl({
            redirectUri: process.env.RC_APP_REDIRECT_URL
        }),
        redirect_uri: process.env.RC_APP_REDIRECT_URL,
        token_json: token_json,
        webhook_uri: process.env.MY_APP_WEBHOOK_URL
    });
});



app.post('/getCookie', function(req,res){

    unirest.post(process.env.AISENSE_SERVER_URL + '/v1/login?appid=' + process.env.AISENSE_APP_ID + '&username=' + process.env.AISENSE_USERNAME)
        .headers({'Authorization': 'Basic ' + process.env.AISENSE_BASE64_ENCODE})
        .send()
        .end(function(response){
            console.log("The response headers are : "+ JSON.stringify(response.headers,null,2));
            var session = response.headers['set-cookie'];
            var tokenString = JSON.stringify(session);
            sessionId = tokenString.split(";")[0].slice(2);
            console.log("The cookie value is :"+ session +"the type is :"+ typeof session);
            console.log("The cookie value is :"+ tokenString +"the type is :"+ typeof tokenString);
            console.log("The cookie value is :"+ tokenString.split(";")[0].slice(2));
            res.send(response.headers);
        });

});

app.get('/getUploadParams', function(req,res){

    unirest.get(process.env.AISENSE_SERVER_URL + '/v1/speech_upload_params?appid=' + process.env.AISENSE_APP_ID + '&username=' + process.env.AISENSE_USERNAME)
        .headers({'Cookie': sessionId})
        .send()
        .end(function(response){
            res.send(response.body);
        });

});

app.post('/uploadRecording',urlencodedParser, function(req,res){

    var multipart = req.body.multiPart || '';
    console.log("The multipart options is :"+ multipart + "the type of multipart is :"+typeof multipart);
    var multipartArray = JSON.parse(multipart);
    console.log("The multipart options for array is :"+ JSON.stringify(multipartArray.data,null,2) + "the type of multipart is :"+typeof multipartArray.data);

    var formData = {
        'x-amz-signature': multipartArray.data['x-amz-signature'],
        'key': multipartArray.data['key'],
        'success_action_status': multipartArray.data['success_action_status'],
        'x-amz-algorithm': multipartArray.data['x-amz-algorithm'],
        'x-amz-credential': multipartArray.data['x-amz-credential'],
        'acl': multipartArray.data['acl'],
        'x-amz-date': multipartArray.data['x-amz-date'],
        'file': fs.createReadStream(__dirname + '/customgreeting.wav')
    };

    request.post({url: process.env.AISENSE_AMAZON_URL, formData:formData}, function optionalCallback(err, httpResponse, body) {
        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Upload successful!  Server responded with:', body);
    });

});
