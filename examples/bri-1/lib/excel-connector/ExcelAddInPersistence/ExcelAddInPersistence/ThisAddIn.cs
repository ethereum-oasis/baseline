using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Xml.Linq;
using Excel = Microsoft.Office.Interop.Excel;
using Office = Microsoft.Office.Core;
using Microsoft.Office.Tools.Excel;
using System.Threading.Tasks;
using System.Threading;
using System.Net;

namespace ExcelAddInPersistence
{
    public partial class ThisAddIn
    {
        private TaskControl myTaskControl;
        private Microsoft.Office.Tools.CustomTaskPane myTaskPane;
        private readonly string PANEL_TITLE = "Control Panel";
        private static readonly int PORT = 11000;
        private static readonly IPAddress SERVER_IP = IPAddress.Any;
        private IPC ipc = new IPC();
        private void ThisAddIn_Startup(object sender, System.EventArgs e)
        {
            myTaskControl = new TaskControl();
            myTaskPane = this.CustomTaskPanes.Add(myTaskControl, this.PANEL_TITLE);
            myTaskPane.Visible = true;
            Excel.Workbook newWorkbook = this.Application.Workbooks.Add(System.Type.Missing);
            createWorkBook();
            ipc.LoadIpcServer( SERVER_IP, PORT);
        }

        private void ThisAddIn_Shutdown(object sender, System.EventArgs e)
        {
        }

        private void createWorkBook()
        {

            // creates a excel sheet to store received data
            Excel.Workbook nativeWorkbook = Globals.ThisAddIn.Application.ActiveWorkbook;
            if (nativeWorkbook != null)
            {
                Excel.Worksheet ws;

                //Published records 
                ws = nativeWorkbook.Sheets.Add();
                ws.Name = "Records";
                string[] recordsHeders = new string[2] { "ID", "DATA" };
                ws.get_Range("A1:B1").Value2 = recordsHeders;
                ws.get_Range("A1", "B1").EntireColumn.AutoFit();

                //Subscriptions 
                ws = nativeWorkbook.Sheets.Add();
                ws.Name = "Subsciptions";
                string[] subsHeders = new string[2] { "type", "field" };
                ws.get_Range("A1:B1").Value2 = subsHeders;
                ws.get_Range("A1", "B1").EntireColumn.AutoFit();


            }
        }


            #region Código generado por VSTO

            /// <summary>
            /// Método necesario para admitir el Diseñador. No se puede modificar
            /// el contenido de este método con el editor de código.
            /// </summary>
            private void InternalStartup()
        {
            this.Startup += new System.EventHandler(ThisAddIn_Startup);
            this.Shutdown += new System.EventHandler(ThisAddIn_Shutdown);
        }

        #endregion
    }
}
