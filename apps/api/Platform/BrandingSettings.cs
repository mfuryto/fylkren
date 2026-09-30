namespace Fylkren.Api.Platform;

public sealed class BrandingSettings
{
    private BrandingSettings() { }
    public BrandingSettings(Guid id) { Id = id; ProductName = "Fylkren"; InstanceName = "Local installation"; Theme = "light"; PrimaryColor = "#315c53"; AccentColor = "#174d43"; TopBarColor = "#202020"; TopBarTextColor = "#ffffff"; CustomCss = ""; }
    public Guid Id { get; private set; }
    public string ProductName { get; private set; } = string.Empty;
    public string InstanceName { get; private set; } = string.Empty;
    public string Theme { get; private set; } = string.Empty;
    public string PrimaryColor { get; private set; } = string.Empty;
    public string AccentColor { get; private set; } = string.Empty;
    public string TopBarColor { get; private set; } = string.Empty;
    public string TopBarTextColor { get; private set; } = string.Empty;
    public string CustomCss { get; private set; } = string.Empty;
    public byte[]? Logo { get; private set; }
    public string? LogoContentType { get; private set; }
    public void Update(string productName, string instanceName, string theme, string primaryColor, string accentColor, string topBarColor, string topBarTextColor, string customCss) { ProductName = productName.Trim(); InstanceName = instanceName.Trim(); Theme = theme; PrimaryColor = primaryColor; AccentColor = accentColor; TopBarColor = topBarColor; TopBarTextColor = topBarTextColor; CustomCss = customCss.Trim(); }
    public void SetLogo(byte[]? logo, string? contentType) { Logo = logo; LogoContentType = logo is null ? null : contentType; }
}
