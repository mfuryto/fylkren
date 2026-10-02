using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Fylkren.Api.Persistence;

// Migration generation only; never used by the running application.
public sealed class FylkrenDesignTimeFactory : IDesignTimeDbContextFactory<FylkrenDbContext>
{
    public FylkrenDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<FylkrenDbContext>()
        .UseNpgsql("Host=localhost;Database=fylkren_design;Username=fylkren;Password=synthetic-design-only")
        .Options);
}
