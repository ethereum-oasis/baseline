//import {MockServer} from './utils/serverMock'
import { TCPClient, ClientState, Records } from '../src/providers/utils/ipc'
import Mitm from 'mitm';
import { Socket } from 'net';
import { exec } from 'child_process';


const PORT = 11000;
let mitm: any; // for connection mockup
let buffer: string;
let server: Socket;
beforeEach(async () => {
    //let mockServer  = await new MockServer(PORT);
    mitm = await Mitm();
    buffer = '';
})

afterEach(async () => { await mitm.disable(); })


describe('Test TCP client', () => {
    test('Test Client creation.', async () => {
        mitm.on("connection", (s) => { console.log("client connected " + s[0]) });
        const client: TCPClient = new TCPClient(11000, '127.0.0.1');
        await new Promise((r) => setTimeout(r, 500)); //wait 2s for error state
        expect(client).toBeInstanceOf(TCPClient); //Check class call
        expect(client).toBeDefined();
        expect(client).not.toBe(null);
        expect(client).not.toBe(undefined);
    }
    );

    test('Test Client send 1 data as string', async () => {
        let send_data = 'hello server';
        mitm.on("connection", (s: Socket) => {
            s.once("data", (data: Buffer) => {
                console.log("recieved " + data); buffer = data.toString();
                expect(buffer).toBe(send_data + ';');
            });
        }
        );

        const client: TCPClient = new TCPClient(11000, '127.0.0.1');
        //await new Promise((r) => setTimeout(r, 500)); //wait 0,5s for error state
        await client.send(send_data, null);
        await new Promise((r) => setTimeout(r, 500)); //wait 0,5s and end test
    }
    );


    test('Test Client send 10 data stings', async () => {
        let send_data = 'hello server';
        let send_data_array: string[] = new Array(10);

        for (let i = 0; i < 10; i++) {
            send_data_array[i] = `${send_data}${i}`;
        }
        let data_ref: number = 0;
        mitm.on("connection", (s: Socket) => {
            s.on("data", (data: Buffer) => {
                console.log("recieved " + data); buffer = data.toString();
                expect(buffer).toBe(send_data_array[data_ref] + ';');
                data_ref++;
            });
        }
        );

        const client: TCPClient = new TCPClient(11000, '127.0.0.1');
        //await new Promise((r) => setTimeout(r, 500)); //wait 0,5s for error state

        send_data_array.forEach(async send_data => {
            client.send(send_data, null);
            await new Promise((r) => setTimeout(r, randomIntFromInterval(0, 100))); // random delay
        });

        await new Promise((r) => setTimeout(r, 500)); //wait 0,5s and end test
    }
    );
});
describe('Test Client Record send', () => {
    test('Test Client send 1 Record', async () => {
        let send_record = { id: 1, value: 'test' };
        mitm.on("connection", (s: Socket) => {
            s.once("data", (data: Buffer) => {
                console.log("recieved " + data); buffer = data.toString();
                expect(buffer).toBe(JSON.stringify(send_record) + ';');
            });
        }
        );
        const client: TCPClient = new TCPClient(11000, '127.0.0.1');
        //await new Promise((r) => setTimeout(r, 500)); //wait 0,5s for error state
        await client.sendRecord(send_record, null);
        await new Promise((r) => setTimeout(r, 500)); //wait 0,5s and end test
    }
    );

    test('Test Client send 10 Records', async () => {
        let send_record = { id: 1, value: 'test' };
        let send_records_array: Records[] = new Array(10);
        for (let i = 0; i < 10; i++) {
            send_records_array[i] = { id: i, value: "test" + i };
        }

        let data_ref = 0;
        mitm.on("connection", (s: Socket) => {
            s.on("data", (data: Buffer) => {
                console.log("recieved " + data); buffer = data.toString();
                expect(buffer).toBe(JSON.stringify(send_records_array[data_ref])+';');
                data_ref++;
            });
        }
        );

        const client: TCPClient = new TCPClient(11000, '127.0.0.1');
        send_records_array.forEach(async send_data => {
            client.sendRecord(send_data, null);
            await new Promise((r) => setTimeout(r, randomIntFromInterval(0, 100))); // random delay
        });
        await new Promise((r) => setTimeout(r, 500)); //wait 0,5s and end test
    }
    );
});

describe('Test Client Record receive', () => {

    test('Test Client recieve 1 Record', async () => {
        let record = { id: 1, value: 'test' };
        mitm.on("connection", async (s: Socket) => {
            await new Promise((r) => setTimeout(r, randomIntFromInterval(0, 200))); //wait 0,..200ms randomly
            s.write(JSON.stringify(record));
        });
        const client: TCPClient = new TCPClient(11000, '127.0.0.1');
        await new Promise((r) => setTimeout(r, 500)); //wait 0,5s and test
        expect(client.latest_receivedData).toEqual(record); //cannot be toBe type problem in serialization 
    });

    test('Test Client recieve 10 Records', async () => {
        let send_records_array: Records[] = new Array(10);
        for (let i = 0; i < 10; i++) {
            send_records_array[i] = { id: i, value: "test" + i };
        }
        let data_ref = 0;
        mitm.on("connection", (s: Socket) => {

            send_records_array.forEach(async rec => {
                await new Promise((r) => setTimeout(r, randomIntFromInterval(0, 200))); //wait 0,..200ms randomly
                s.write(JSON.stringify(rec));
            });
        }
        );

        const client: TCPClient = new TCPClient(11000, '127.0.0.1');
        send_records_array.forEach(async rec => {
            await new Promise((r) => setTimeout(r, randomIntFromInterval(0, 100))); // random delay
            expect(client.latest_receivedData).toEqual(rec);
        });
        //cannot be toBe type problem in serialization 
    });


}
);

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}
