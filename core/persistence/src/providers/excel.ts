import { rejects } from 'assert';
import { IPersistenceService } from './..';
import { TCPClient, ClientState } from './utils/ipc'


enum Type {
  publish,
  subscribe,
  unsubscribe,
  alert
}

/**
 * interface for message sending to Excel Endpoint
 */
interface DataIPC {
  type: Type;
  data: any;
  data_type?: string;
}


export class Excel implements IPersistenceService {

  private config: any;
  private SERVER_IP: string = '192.168.43.92'; //WSL only sees adptaters ip from windows put here any adaptater ip intenet connection not required.
  private SERVER_PORT: number = 11000;
  private client: TCPClient;
  private baselineMsgSend: (data: string) => any = (data: string) => { console.log('data to relay to baseline ' + data) }

  constructor(config: any) {
    this.config = config;
    if (this.config) {
      if ('port' in this.config)
        this.SERVER_PORT = config.port;
      if ('ip' in this.config)
        this.SERVER_IP = config.ip;
      if ('baselineMsgSend' in this.config) {
        this.baselineMsgSend = this.config.baselineMsgSend;
      }
    }
    this.client = new TCPClient(this.SERVER_PORT, this.SERVER_IP, this.baselineMsgSend);
  }

  // alert is an array of identifiers to send to backend Excel
  alert(params: any): Promise<any> {
    let alerted: any[] = [];
    return new Promise<any>(async (resolve, reject) => {
      if (!params) {
        reject("Excel persistence: no params on alert rejected");
      }
      if (!params.alerts) {
        reject("Excel persistence: no alerts params on alert rejected");
      }
      params.alerts.forEach(async a => {
        if (!a.identifier) {
          reject('Excel Persistense: alert has no identifier');
        }
        const alert: DataIPC = {
          type: Type.alert,
          data: a.identifier
        }
        await this.client.sendRecord(alert, reject);
        alerted.push(a);
        console.log(`Excel Persistence: alert for record with ${a.identifier}`);
        if (a.message && (typeof a.message == 'string' || a.message instanceof String)) {
          // optional message
          console.log('Excel Persistance: alert message > ' + a.message);
        }
      });
      resolve(alerted);
    }).catch();
  }

  // subscribe to specific fields via identifiers and RegExp
  // params.fields refers to the set or subset of core/types/persistence Model.fields with type string | string[] | RegEx
  // params {
  //  [key: sting]: any; 
  //  fields: string | string[] | RegEx;
  // }
  subscribe(params: any): Promise<any> {
    return new Promise<void>(async (resolve, reject) => {
      if (!params) {
        //console.log("params is empty");
        reject("Excel persistence: no params rejected");
      }
      if (!params.fields) {
        //console.log("params is empty");
        reject("Excel persistence: no fields params rejected");
      }
      if (params.fields) {
        let data_type = "";
        if (typeof params.fields == 'string' || params.fields instanceof String)
          data_type = "string";

        if (params.fields instanceof RegExp)
          data_type = "RegExp";

        if (Array.isArray(params.fields) && params.fields.every(e => (typeof e == 'string' || e instanceof String)) && params.fields.length > 0)
          data_type = "string[]";

        const data: DataIPC = {
          type: Type.subscribe,
          data: params.fields.toString(),
          data_type: data_type
        }
        await this.client.sendRecord(data, reject);
        resolve();
      } else {
        reject('Excel persistence: no fields in params to subscribe to');
      }
    }).catch();
  }

  // records to be published to Excel backend
  // params {
  //  [key: string]:any
  //  records: [identifier, [key:string] : any ]
  // } 
  publish(params: any): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      if (!params) {
        //console.log("params is empty");
        reject("Excel persistence: no params rejected");
      }
      if (!params.records) {
        //console.log("params is empty");
        reject("Excel persistence: no records params rejected");
      }
      params.records.forEach(async rec => {
        if (rec.identifier) {
          const data: DataIPC = {
            type: Type.publish,
            data: rec
          };
          await this.client.sendRecord(data, reject);
        } else {
          reject("Excel persistence: not identifier record rejected ");
        }
      });
      resolve(params.records);
    }
    ).catch();
  }

  unsubscribe(params: any): Promise<any> {
    throw new Error('not implemented Yet');
  }

  query(q: string): Promise<any> {
    throw new Error('not implemented');
  }

  read(id: string): Promise<any> {
    throw new Error('not implemented');
  }

  create(params: any): Promise<any> {
    throw new Error('not implemented');
  }

  update(id: string, params: any): Promise<any> {
    throw new Error('not implemented');
  }

  delete(id: string): Promise<any> {
    throw new Error('not implemented');
  }


}

export async function excelServiceFactory(
  config?: any,
): Promise<Excel> {
  return new Excel(config);
}


