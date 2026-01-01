using System.IO;

namespace HomeBudget.Backend.Gateway.Models
{
    internal record SslOptions
    {
        public int HttpsPort { get; set; }
        public int HttpPort { get; set; }
        public string CertificatePath { get; set; } = "/app";
        public string CertificateName { get; set; }
        public string Password { get; set; }

        public string GetFullPath() => Path.Combine(CertificatePath, CertificateName);
    }
}
