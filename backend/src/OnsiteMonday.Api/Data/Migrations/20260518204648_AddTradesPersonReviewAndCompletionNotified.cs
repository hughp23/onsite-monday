using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnsiteMonday.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTradesPersonReviewAndCompletionNotified : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletionNotifiedAt",
                table: "Jobs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TradesPersonReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerId = table.Column<Guid>(type: "uuid", nullable: false),
                    RevieweeId = table.Column<Guid>(type: "uuid", nullable: false),
                    JobId = table.Column<Guid>(type: "uuid", nullable: false),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TradesPersonReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TradesPersonReviews_Jobs_JobId",
                        column: x => x.JobId,
                        principalTable: "Jobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TradesPersonReviews_Users_RevieweeId",
                        column: x => x.RevieweeId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TradesPersonReviews_Users_ReviewerId",
                        column: x => x.ReviewerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TradesPersonReviews_JobId",
                table: "TradesPersonReviews",
                column: "JobId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TradesPersonReviews_RevieweeId",
                table: "TradesPersonReviews",
                column: "RevieweeId");

            migrationBuilder.CreateIndex(
                name: "IX_TradesPersonReviews_ReviewerId",
                table: "TradesPersonReviews",
                column: "ReviewerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TradesPersonReviews");

            migrationBuilder.DropColumn(
                name: "CompletionNotifiedAt",
                table: "Jobs");
        }
    }
}
