using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnsiteMonday.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionCancelFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CancelAtPeriodEnd",
                table: "Subscriptions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CurrentPeriodEnd",
                table: "Subscriptions",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancelAtPeriodEnd",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "CurrentPeriodEnd",
                table: "Subscriptions");
        }
    }
}
