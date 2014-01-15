module.exports = function(app, express) {
	
	app.use('/coolstuff', express.static(__dirname+'/coolstuff'));
	
	app.get('/coolstuff/secret', app.checkUser, app.checkAuth, function(req, res) {
		res.send(req.session.user.name+' is a winner!');
	});
	
	app.get('/coolstuff/notsecret', function(req, res) {
		res.send('public stuff');
	})
	
	return {
		name: 'coolstuff',
		authorizedUsers: [ 'bbradley' ]
	};
	
}
