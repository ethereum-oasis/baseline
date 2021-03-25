
import { IPersistenceService, persistenceProviderExcel, persistenceServiceFactory } from '../src/index';
import Mitm from 'mitm';
let provider: IPersistenceService;
let mitm: any; // for connection mockup
import { Socket } from 'net';

beforeEach(async () => {
    provider = await persistenceServiceFactory(persistenceProviderExcel, {ip:'127.0.0.1'});
    mitm = await Mitm();
    mitm.on("connection", (s: Socket) => { });
});

afterEach(async () => { await mitm.disable(); });

describe('Test Persistence publish ', () => {

    test('Test Persistence publish should reject empty params', async () => {
        await expect(provider.publish(undefined)).rejects.toEqual("Excel persistence: no params rejected"
        );
    });

    test('Test Persistence publish should reject empty records', async () => {
        let records = [{ identifier: 1, data: 'test' },
        { identifier: 2, data: 'test' }
        ];
        let params = {
            id: 1,
            test: 'test',
            records: null
        };
        await expect(provider.publish(params)).rejects.toEqual("Excel persistence: no records params rejected"
        );
    });



    test('Test Persistence publish', async () => {
        let records = [{ identifier: 1, data: 'test' },
        { identifier: 2, data: 'test' }
        ];
        let params = {
            id: 1,
            test: 'test',
            records: records
        };
        await expect(await provider.publish(params)).toBe(records);
    });
}
);

describe("Test persistence subcribe", () => {
    test('Test Persistence subscribe should reject empty params', async () => {
        await expect(provider.subscribe(undefined)).rejects.toEqual("Excel persistence: no params rejected");
    });

    test('Test Persistence subscribe should reject no fields', async () => {
        let params = {
            id: 'test',
            other: 'me '
        }
        await  expect(provider.subscribe(params)).rejects.toEqual("Excel persistence: no fields params rejected");
    });


    test('Test Persistence subscribe should resolve to undefined on good data', async () => {
        let params = {
            id: 'test',
            other: 'me ',
            fields: 'test' 
        }
        await  expect(provider.subscribe(params)).resolves.toEqual(undefined);
    });
});



describe("Test persistence alert", () => {
    test('Test Persistence alerv should reject empty params', async () => {
        await expect(provider.alert(undefined)).rejects.toEqual("Excel persistence: no params on alert rejected");
    });
    test('Test Persistence alerv should reject empty alarts params', async () => {
        let params = {
            id: 1,
            other: 'whatever'
        }
        await expect(provider.alert(params)).rejects.toEqual("Excel persistence: no alerts params on alert rejected");
    });
    test('Test Persistence alert params', async () => {
        let _alerts = [ { identifier:1, data:'hola'}, {identifier:2, data:"mundo" }];
        let params = {
            id: 1,
            other: 'whatever',
            alerts: _alerts
        }
        await expect(provider.alert(params)).resolves.toEqual(_alerts);
    });
});



