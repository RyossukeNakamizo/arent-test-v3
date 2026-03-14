using Microsoft.EntityFrameworkCore;
using IssueManager.Api.Domain.Entities;
using IssueManager.Api.Domain.Enums;
using IssueManager.Api.Domain.ValueObjects;

namespace IssueManager.Api.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public DbSet<Issue> Issues => Set<Issue>();
    public DbSet<Photo> Photos => Set<Photo>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Issue>(b =>
        {
            b.ToTable("issues");
            b.HasKey(e => e.Id);
            b.Property(e => e.Title).HasMaxLength(200).IsRequired();
            b.Property(e => e.Description).HasColumnType("text");
            b.Property(e => e.IssueType).HasConversion<string>().HasMaxLength(50);
            b.Property(e => e.Status).HasConversion<string>().HasMaxLength(50);
            b.Property(e => e.CreatedAt);
            b.Property(e => e.UpdatedAt);

            // Location as owned entity (embedded in issues table)
            b.OwnsOne(e => e.Location, loc =>
            {
                loc.Property(l => l.Type).HasColumnName("location_type").HasConversion<string>().HasMaxLength(20);
                loc.Property(l => l.DbId).HasColumnName("location_db_id");
                loc.OwnsOne(l => l.WorldPosition, wp =>
                {
                    wp.Property(p => p.X).HasColumnName("location_x");
                    wp.Property(p => p.Y).HasColumnName("location_y");
                    wp.Property(p => p.Z).HasColumnName("location_z");
                });
            });

            // Photos navigation
            b.HasMany(e => e.Photos)
             .WithOne()
             .HasForeignKey("IssueId")
             .OnDelete(DeleteBehavior.Cascade);

            // Access private backing field
            b.Navigation(e => e.Photos).HasField("_photos");
        });

        modelBuilder.Entity<Photo>(b =>
        {
            b.ToTable("photos");
            b.HasKey(e => e.Id);
            b.Property(e => e.BlobKey).HasMaxLength(500).IsRequired();
            b.Property(e => e.PhotoType).HasConversion<string>().HasMaxLength(20);
            b.Property(e => e.UploadedAt);
            b.Property<Guid>("IssueId");
        });
    }
}
