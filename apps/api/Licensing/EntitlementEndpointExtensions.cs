using Fylkren.Api.Persistence;

namespace Fylkren.Api.Licensing;

internal static class EntitlementEndpointExtensions
{
    internal static TBuilder RequireFeature<TBuilder>(this TBuilder builder, string feature)
        where TBuilder : IEndpointConventionBuilder
    {
        if (!FeatureCatalog.IsKnown(feature)) throw new ArgumentException("Unknown feature entitlement.", nameof(feature));
        builder.AddEndpointFilter(async (context, next) =>
        {
            var services = context.HttpContext.RequestServices;
            var license = services.GetRequiredService<LicenseService>();
            var db = services.GetRequiredService<FylkrenDbContext>();
            if (!await license.Has(db, feature, context.HttpContext.RequestAborted))
                return Results.Problem(statusCode: StatusCodes.Status403Forbidden,
                    title: "An Enterprise entitlement is required for this feature.",
                    extensions: new Dictionary<string, object?> { ["code"] = "enterprise_entitlement_required", ["feature"] = feature });
            return await next(context);
        });
        return builder;
    }
}
