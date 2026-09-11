using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnsiteMonday.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveMangopayAddStripeConnect : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Rename Job columns (preserves existing data)
            migrationBuilder.RenameColumn(
                name: "EscrowPayInId",
                table: "Jobs",
                newName: "StripeCheckoutSessionId");

            migrationBuilder.RenameColumn(
                name: "EscrowTransferId",
                table: "Jobs",
                newName: "StripeTransferId");

            // Drop Mangopay User columns
            migrationBuilder.DropColumn(name: "MangopayUserId",       table: "Users");
            migrationBuilder.DropColumn(name: "MangopayWalletId",     table: "Users");
            migrationBuilder.DropColumn(name: "MangopayKycStatus",    table: "Users");
            migrationBuilder.DropColumn(name: "MangopayKycDocumentId",table: "Users");
            migrationBuilder.DropColumn(name: "MangopayBankAccountId",table: "Users");
            migrationBuilder.DropColumn(name: "AutoWithdraw",         table: "Users");

            // Add Stripe Connect User columns
            migrationBuilder.AddColumn<string>(
                name: "StripeConnectAccountId",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "StripeConnectOnboardingComplete",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(name: "StripeCheckoutSessionId", table: "Jobs", newName: "EscrowPayInId");
            migrationBuilder.RenameColumn(name: "StripeTransferId",        table: "Jobs", newName: "EscrowTransferId");

            migrationBuilder.DropColumn(name: "StripeConnectAccountId",        table: "Users");
            migrationBuilder.DropColumn(name: "StripeConnectOnboardingComplete",table: "Users");

            migrationBuilder.AddColumn<string>(name: "MangopayUserId",       table: "Users", type: "text", nullable: true);
            migrationBuilder.AddColumn<string>(name: "MangopayWalletId",      table: "Users", type: "text", nullable: true);
            migrationBuilder.AddColumn<string>(name: "MangopayKycStatus",     table: "Users", type: "text", nullable: false, defaultValue: "none");
            migrationBuilder.AddColumn<string>(name: "MangopayKycDocumentId", table: "Users", type: "text", nullable: true);
            migrationBuilder.AddColumn<string>(name: "MangopayBankAccountId", table: "Users", type: "text", nullable: true);
            migrationBuilder.AddColumn<bool>(  name: "AutoWithdraw",          table: "Users", type: "boolean", nullable: false, defaultValue: false);
        }
    }
}
