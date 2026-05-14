using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnsiteMonday.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddKycAndWithdrawalFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoWithdraw",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MangopayBankAccountId",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MangopayKycDocumentId",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MangopayKycStatus",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "none");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutoWithdraw",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MangopayBankAccountId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MangopayKycDocumentId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MangopayKycStatus",
                table: "Users");
        }
    }
}
