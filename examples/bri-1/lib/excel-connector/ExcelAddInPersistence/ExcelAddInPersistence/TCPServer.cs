using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ExcelAddInPersistence
{
    public class DataReceivedEventArgs : EventArgs
    {
        public NetworkStream Stream { get; private set; }

        public DataReceivedEventArgs(NetworkStream stream)
        {
            Stream = stream;
        }
    }

    public class TcpServer : IDisposable
    {
        private readonly TcpListener _listener;
        private CancellationTokenSource _tokenSource;
        private bool _listening;
        private CancellationToken _token;

        public event EventHandler<DataReceivedEventArgs> OnDataReceived;

        public TcpServer(IPAddress address, int port)
        {
            _listener = new TcpListener(address, port);
        }

        public bool Listening => _listening;

        public async Task StartAsync(CancellationToken? token = null)
        {
            _tokenSource = CancellationTokenSource.CreateLinkedTokenSource(token ?? new CancellationToken());
            _token = _tokenSource.Token;
            _listener.Start();
            _listening = true;

            try
            {
                while (!_token.IsCancellationRequested)
                {
                    await Task.Run(async () =>
                    {
                        var tcpClientTask = _listener.AcceptTcpClientAsync();
                        var result = await tcpClientTask;
                        while (result.Connected)
                        {
                            OnDataReceived?.Invoke(this, new DataReceivedEventArgs(result.GetStream()));
                        }
                    }, _token);
                }
            }
            finally
            {
                _listener.Stop();
                _listening = false;
            }
        }

        public void Stop()
        {
            _tokenSource?.Cancel();
        }

        public void Dispose()
        {
            Stop();
        }
    }
}