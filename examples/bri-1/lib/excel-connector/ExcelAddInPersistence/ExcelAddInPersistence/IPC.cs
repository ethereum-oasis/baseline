using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Excel = Microsoft.Office.Interop.Excel;

namespace ExcelAddInPersistence
{
    class IPC
    {
        public void LoadIpcServer(IPAddress server_ip, int port)
        {
            using (var server = new TcpServer(server_ip, port))
            {
                //data received handler
                server.OnDataReceived += async (sender_tcp, e_tcp) =>
                {
                    int bytesRead = 0;
                    byte[] read_buffer = new byte[1024];
                    try
                    {
                        do
                        {
                            // Read buffer write to console
                            bytesRead = e_tcp.Stream.Read(read_buffer, 0, 1024);
                            string data = Encoding.UTF8.GetString(read_buffer);
                            Log.WriteLine($"receives {bytesRead} bytes: {data}");

                            if (bytesRead > 0)
                            {
                                processData(data);
                            }
                        }
                        while (bytesRead > 0 && e_tcp.Stream.DataAvailable);
                        var response = Encoding.ASCII.GetBytes("{\"responce\": \"Server Done !\"}");
                        e_tcp.Stream.Write(response, 0, response.Length);
                    }
                    catch (Exception error)
                    {
                        // Log.WriteLine("ERROR connection deleted: " + error.Message);
                    }
                };

                Task.Run(async () =>
                {
                    var serverTask = server.StartAsync();
                    await serverTask;

                });

            }

        }

        private void processData(string data)
        {
            try
            {
                string[] datas = data.Split(';');
                foreach (string d in datas)
                {
                    if (!string.IsNullOrEmpty(d))
                    {
                        dynamic desData = JsonConvert.DeserializeObject(d);
                        Log.WriteLine("type>>>>>" + desData.type);
                        Log.WriteLine("data>>>>>" + desData.data);

                        switch ((int)desData.type)
                        {
                            case (int)Type.publish:
                                //add record to sheet
                                addRecordsIds((string)desData.data.identifier, (string)desData.data.data);
                                break;
                            case (int)Type.subscribe:
                                // add subscription to sheet 
                                addToSubscriptions((string)desData.data, (string)desData.data_type);
                                break;
                            case (int)Type.alert:
                                Log.WriteLine("Alert");
                                System.Windows.Forms.MessageBox.Show("alert received for id" + desData.data, "Alert");
                                break;
                            default:
                                Log.WriteLine("Not implemted type");
                                break;

                        }
                    }
                }
            }
            catch (Exception e)
            {
                Log.WriteLine("error in deserialization" + e.Message);

            }
        }


        // data is string, a string[] or a RegExp 
        private bool addToSubscriptions(String data, string data_type)
        {
            Excel.Worksheet ws = Globals.ThisAddIn.Application.ActiveWorkbook.Sheets["Subsciptions"];
            int i = 2;
            string val;
            if (data_type == "string")
            {
                do
                {
                    val = ws.Cells[i, 2].Value2;

                    if (data == val)
                        return false;
                    i++;
                } while (val != "" && val != null);

                ws.Cells[i - 1, 2].Value2 = "'" + data;
                ws.Cells[i - 1, 1].Value2 = "string";
            }


            if (data_type == "RegExp")
            {

                Regex rgx = new Regex(data);
                do
                {
                    
                    val = ws.Cells[i, 2].Value2;
                    i++;
                    if (val == null)
                        break;
                    

                    if (rgx.Equals(new Regex(val)))
                        return false;
                } while (val != "" && val != null);

                ws.Cells[i - 1, 2].Value2 = "'" + data;
                ws.Cells[i - 1, 1].Value2 = "RegExp";
            }

            if (data_type == "string[]")
            {

                string array = data.Replace("[", "");
                array = array.Replace("]", "");
                string[] datas = array.Split(',');
                foreach (string d in datas)

                {
                    i = 2;
                    bool insert = true;
                    do
                    {

                        val = ws.Cells[i, 2].Value2;
                        i++;

                        if ((d) == val)
                        {
                            insert = false;
                            break;
                        }
                    } while (val != "" && val != null);

                    if (insert)
                    {
                        ws.Cells[i-1 , 2].Value2 = "'" + d;
                        ws.Cells[i-1, 1].Value2 = "string";
                    }
                }
            }

            ws.get_Range("A1", "B1").EntireColumn.AutoFit();
            return true;
        }
        private bool addRecordsIds(string id, string data)
        {
            Excel.Worksheet ws = Globals.ThisAddIn.Application.ActiveWorkbook.Sheets["Records"];
            int i = 2;
            string val;
            do
            {
                val = ws.Cells[i, 1].Value2;

                if (("'" + id) == val)
                    return false;
                i++;
            } while (val != "" && val != null);

            ws.Cells[i - 1, 1].Value2 = "'" + id;
            ws.Cells[i - 1, 2].Value2 = data;
            ws.get_Range("A1", "B1").EntireColumn.AutoFit();
            return true;
        }
    }
    enum Type
    {
        publish,
        subscribe,
        unsubscribe,
        alert
    }
}
