namespace HomeBudget.Backend.Gateway.Models
{
    public record SslOptions
    {
        public int HttpsPort { get; set; }
        public int HttpPort { get; set; }
        public string CertificateName { get; set; }
        public string Password { get; set; }
    }
}
