using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnsiteMonday.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameFirebaseUidToCognitoSub : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "FirebaseUid",
                table: "Users",
                newName: "CognitoSub");

            migrationBuilder.RenameIndex(
                name: "IX_Users_FirebaseUid",
                table: "Users",
                newName: "IX_Users_CognitoSub");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "CognitoSub",
                table: "Users",
                newName: "FirebaseUid");

            migrationBuilder.RenameIndex(
                name: "IX_Users_CognitoSub",
                table: "Users",
                newName: "IX_Users_FirebaseUid");
        }
    }
}
