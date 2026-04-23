using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnsiteMonday.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddJobCancellationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "Jobs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CancelledAt",
                table: "Jobs",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "Jobs");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "Jobs");
        }
    }
}
