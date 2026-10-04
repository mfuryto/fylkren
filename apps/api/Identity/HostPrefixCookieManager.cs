using Microsoft.AspNetCore.Authentication.Cookies;

namespace Fylkren.Api.Identity;

internal sealed class HostPrefixCookieManager(string prefix) : ICookieManager
{
    private readonly ChunkingCookieManager inner = new();

    public string? GetRequestCookie(HttpContext context, string key) =>
        inner.GetRequestCookie(context, Name(key));

    public void AppendResponseCookie(HttpContext context, string key, string? value, CookieOptions options)
    {
        Harden(options);
        inner.AppendResponseCookie(context, Name(key), value, options);
    }

    public void DeleteCookie(HttpContext context, string key, CookieOptions options)
    {
        Harden(options);
        inner.DeleteCookie(context, Name(key), options);
    }

    private string Name(string key) => key.StartsWith("__Host-", StringComparison.Ordinal)
        ? key
        : prefix + key.TrimStart('.');

    private static void Harden(CookieOptions options)
    {
        options.Domain = null;
        options.Path = "/";
        options.Secure = true;
        options.HttpOnly = true;
        options.SameSite = SameSiteMode.None;
    }
}
