using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnsiteMonday.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMutedNotificationTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<string>>(
                name: "MutedNotificationTypes",
                table: "Users",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MutedNotificationTypes",
                table: "Users");
        }
    }
}
