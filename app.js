/* Require everything */
var https = require('https'),
		fs = require('fs'),
		pem = require('pem'), // for https key/cert files
		express = require('express'), // for express
		LdapAuth = require('ldapauth-fork'), // for ldap
		log4js = require('log4js'); // for logging


/* Initiate the app */
var app = express();


/* Configure LDAP * adminDn and adminPassword should be a static role account */
var	ldap = new LdapAuth({
	url: 'ldap://10.0.0.1',
	adminDn: 'user@ad.company.com',
	adminPassword: 'staticpassword',
	searchBase: 'OU=blargh,OU=honk,OU=stuffhere,DC=ad,DC=company,DC=com',
	searchFilter: '(sAMAccountName={{username}})'
});


/* Configure logging * you can add "app.logger.info('something to log');" in a service */
log4js.configure({
	appenders: [
		{ type: 'console' },
		{ type: 'file', filename: __dirname+'/logs/awethome.log', category: 'awethome' }
	]
});
app.logger = log4js.getLogger('awethome');
app.logger.setLevel('INFO');


/* create the fn to validate users */
app.checkUser = function(req, res, next) {
	if (req.session.user) {
		next();
	}
	else {
		req.session.targetUrl = req.originalUrl;
		res.redirect('/login');
	}
};


/* validate that the current user is authorized to use the service */
app.authorizedUsers = {};
app.checkAuth = function(req, res, next) {
	var service = req.path.match(/^\/([^\/]+)\//)[1],
			authorizedUsers = app.authorizedUsers[service],
			user = (req.session.user) ? req.session.user.sAMAccountName : false;
	if (authorizedUsers && user) {
		authorizedUsers = authorizedUsers.map(function(u) { return u.toLowerCase(); });
		if (authorizedUsers.indexOf(user.toLowerCase()) > -1) { next(); }
		else { res.send('user authenticated, but unauthorized'); }
	}
	else {
		res.send('user is invalid or no authentication list provided for this service: '+service);
	}
};


/* Configure the app */
app.configure(function() {
	
	app.logger.info('configuring app');
	
	app.use(express.bodyParser());
	app.use(express.cookieParser('BLARGH'));
	app.use(express.session());
	
	// splash page, open to the world
	app.get('/', function(req, res) {
		res.send({ blargh: 'honk!' });
	});
	
	// send the login page
	app.get('/login', function(req, res) {
		res.sendfile('login.html');
	});
	
	// logout & redirect to login
	app.get('/logout', function(req, res) {
		app.logger.info('logout: '+req.session.user.sAMAccountName);
		delete req.session.user;
		res.redirect('/login');
	});
	
	// handle authentication requests
	app.post('/authenticate', function(req, res) {
		app.logger.info('authenticating: '+req.body.username);
		ldap.authenticate(req.body.username, req.body.password, function(err, user) {
			if (err) {
				app.logger.info('authentication for '+req.body.username+' failed');
				res.redirect('/login?invalid');
			}
			else {
				app.logger.info('authentication for '+req.body.username+' succeeded');
				req.session.user = user;
				var url = req.session.targetUrl || '/';
				delete req.session.targetUrl;
				res.redirect(url);
			}
		});
	});
	
	// load routes & services
	fs.readdir('services', function(err, files) {
		app.logger.info('services loading');
		files.forEach(function(file) {
			// skip non .js files
			if (!file.match(/\.js$/)) { return false; }
			// load the service object & contained routes
			var service = require(__dirname+'/services/'+file)(app, express);
			// load the authorized users for this service
			app.authorizedUsers[service.name] = service.authorizedUsers
			app.logger.info('service started: '+service.name)
		});
		app.logger.info('services loaded');
	});
	
});


/* start a secure server */
app.logger.info('initiating server');
pem.createCertificate({ days: 1, selfSigned: true }, function(err, keys) {
	app.logger.info('certificates created');
	https
		.createServer({ key: keys.serviceKey, cert: keys.certificate }, app)
		.listen(4443);
	app.logger.info('server started');
});
