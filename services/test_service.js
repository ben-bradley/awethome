module.exports = function(app, express) {
	
	app.get('/testing', function(req, res) {
		res.send({ blargh:'honk' });
	});
	
	return {
		name: 'test service'
	};
	
}
