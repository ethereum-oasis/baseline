
import { IPersistenceService, persistenceProviderExcel, persistenceServiceFactory } from '../src/index';
let provider: IPersistenceService;
import { Socket } from 'net';

beforeAll(async () => {
    provider = await persistenceServiceFactory(persistenceProviderExcel, { ip: '192.168.43.92', port: 11000 });
});

describe('Excel ADD-in Tests', () => {
    describe('Test Persistence publish on Excel ADD-in', () => {

        test('Test Persistence publish should reject empty params', async () => {
    await expect(provider.publish(undefined)).rejects.toEqual("Excel persistence: no params rejected"
    );
});

test('Test Persistence publish should reject empty records', async () => {
    let records = [{ identifier: 1, data: 'test no records' },
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
    let records = [{ identifier: 1, data: 'test pub 1 records' },
    { identifier: 2, data: 'test pub 2 records' }
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

describe("Test persistence subcribe on Excel ADD-in", () => {
    test('Test Persistence subscribe should reject empty params', async () => {
        await expect(provider.subscribe(undefined)).rejects.toEqual("Excel persistence: no params rejected");
    });

    test('Test Persistence subscribe should reject no fields', async () => {
        let params = {
            id: 'test',
            other: 'me '
        }
        await expect(provider.subscribe(params)).rejects.toEqual("Excel persistence: no fields params rejected");
    });


    test('Test Persistence subscribe to string', async () => {
        let params = {
            id: 'test',
            other: 'me ',
            fields: 'test'
        }
        await expect(provider.subscribe(params)).resolves.toEqual(undefined);
    });
    test('Test Persistence subscribe to RegExp', async () => {
        let params = {
            id: 'test',
            other: 'me ',
            fields: RegExp('/[0-9]test/m')
        }
        await expect(provider.subscribe(params)).resolves.toEqual(undefined);
    });

    test('Test Persistence subscribe to String[]', async () => {
        let params = {
            id: 'test',
            other: 'me ',
            fields: ['test', 'this', 'that']
        }
        await expect(provider.subscribe(params)).resolves.toEqual(undefined);
    });

});



describe("Test persistence alert on Excel ADD-in", () => {
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
        let _alerts = [{ identifier: 1, data: 'hola' }, { identifier: 2, data: "mundo" }];
        let params = {
            id: 1,
            other: 'whatever',
            alerts: _alerts
        }
        await expect(provider.alert(params)).resolves.toEqual(_alerts);
    });
});
});


