var supertest = require("supertest");
var should = require("should");
const config = require('../config.js');

// This agent refers to PORT where program is runninng.
var server = supertest.agent("http://localhost:", config.express.port);

// UNIT test begin
describe("HTTP request unit test",function(){

  // #1 should return home page
  it("should return /api/env_light",function(done){
    // calling home page api
    server
      .get("/api/env_light")
      .expect("Content-type",/json/)
      .expect(200) // THis is HTTP response
      .end(function(err,res){
        // HTTP status should be 200
        res.status.should.equal(200);
        // Error key should be false.
        res.body.error.should.equal(false);
        done();
      });
  });

  // #2 should return 404
  it("should return 404",function(done){
    server
      .get("/random")
      .expect(404)
      .end(function(err,res){
        res.status.should.equal(404);
        done();
      });
  })


});