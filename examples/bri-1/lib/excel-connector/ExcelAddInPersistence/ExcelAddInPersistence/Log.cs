using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ExcelAddInPersistence
{
    class Log
    {
        static String header = "DEBUG> ";
        public static void WriteLine(String text)
        {
            System.Diagnostics.Debug.WriteLine(header + text);
        }

    }
}
