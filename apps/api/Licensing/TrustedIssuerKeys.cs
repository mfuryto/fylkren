namespace Fylkren.Api.Licensing;

// Public P-256 SPKI verification key for licenses issued by THUNOLD-OLSEN.
// SHA-256 of the DER bytes: 9d52a2d724c72da913c9b87f2db2f8c8d4ac1f74cc1689ca14f6c0bf7b65e8fe
// Never place a private signing key or passphrase in this repository.
internal static class TrustedIssuerKeys
{
    internal const string ProductionSpki =
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEzlS+df5UeFiFqMK9SlcwDVZggRH/yPJ91g34a8OapksRkBYDd5LsjWaxEHfofmOEhOGFozVPq+2ygkpoXh4GAw==";
}
