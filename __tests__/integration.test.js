const request = require('supertest');

const buyerApiURL = 'http://localhost:8001';
const buyerMessengerURL = 'http://localhost:4001';
const supplierMessengerURL = 'http://localhost:4002';
const supplierApiURL = 'http://localhost:8002';

describe('Check that containers are ready', () => {
  test('Buyer messenger GET /health-check returns 200', async () => {
    const res = await request(buyerMessengerURL).get('/api/v1/health-check');
    expect(res.statusCode).toEqual(200);
  });

  test('Buyer REST API GET /health-check returns 200', async () => {
    const res = await request(buyerApiURL).get('/api/v1/health-check');
    expect(res.statusCode).toEqual(200);
  });

  test('Supplier messenger GET /health-check returns 200', async () => {
    const res = await request(supplierMessengerURL).get('/api/v1/health-check');
    expect(res.statusCode).toEqual(200);
  });

  test('Supplier REST API GET /health-check returns 200', async () => {
    const res = await request(supplierApiURL).get('/api/v1/health-check');
    expect(res.statusCode).toEqual(200);
  });

});

describe('Buyer sends new RFP to supplier', () => {
  let supplierMessengerId;
  let rfpId;
  const sku = 'FAKE-SKU-123';

  test('Supplier messenger GET /identities', async () => {
    const res = await request(supplierMessengerURL).get('/api/v1/identities');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThan(0);
    supplierMessengerId = res.body[0].publicKey;
  });

  test('Buyer graphql mutation createRFP() returns 400 withOUT sku', async () => {
    const postBody = ` mutation {
          createRFP( input: {
            skuDescription: "Widget 200",
            description: "Widget order for SuperWidget",
            proposalDeadline: 1578065104,
            recipients: [ { identity: "${supplierMessengerId}" } ]
          })
          { _id } 
        } `
    const res = await request(buyerApiURL)
      .post('/graphql')
      .send({ query: postBody });
    expect(res.statusCode).toEqual(400);
  });

  test('Buyer graphql mutation createRFP() returns 200', async () => {
    const postBody = ` mutation {
          createRFP( input: {
            sku: "${sku}",
            skuDescription: "Widget 200",
            description: "Widget order for SuperWidget",
            proposalDeadline: 1578065104,
            recipients: [{ 
              partner: { 
                identity: "${supplierMessengerId}",
                name: "FakeName",
                address: "0x0D8c04aCd7c417D412fe4c4dbB713f842dcd3A65",
                role: "supplier"
              }
            }]
          })
          { _id, sku } 
        } `
    const res = await request(buyerApiURL)
      .post('/graphql')
      .send({ query: postBody });
    expect(res.statusCode).toEqual(200);
    rfpId = res.body.data.createRFP._id;
  });

  test('Buyer graphql query rfp() returns 200', async () => {
    const queryBody = `{ rfp(uuid: "${rfpId}") { _id, sku } } `
    // Wait for db to update
    let res;
    for (let retry = 0; retry < 3; retry++) {
      res = await request(buyerApiURL)
        .post('/graphql')
        .send({ query: queryBody });
      if (res.body.data.rfp !== null) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.rfp._id).toEqual(rfpId);
    expect(res.body.data.rfp.sku).toEqual(sku);
  });

  test('Supplier graphql query rfp() returns 200', async () => {
    const queryBody = `{ rfp(uuid: "${rfpId}") { _id, sku } } `
    // Wait for db to update
    let res;
    for (let retry = 0; retry < 3; retry++) {
      res = await request(supplierApiURL)
        .post('/graphql')
        .send({ query: queryBody });
      if (res.body.data.rfp !== null) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.rfp._id).toEqual(rfpId);
    expect(res.body.data.rfp.sku).toEqual(sku);
  });
});