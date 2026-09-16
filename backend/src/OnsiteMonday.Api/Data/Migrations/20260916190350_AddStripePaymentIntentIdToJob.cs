using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnsiteMonday.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddStripePaymentIntentIdToJob : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StripePaymentIntentId",
                table: "Jobs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StripePaymentIntentId",
                table: "Jobs");
        }
    }
}
