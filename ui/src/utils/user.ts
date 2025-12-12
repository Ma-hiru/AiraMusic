// userlist
// userlikedids
// userlokedlist
class User {
  _userLikedListID: Nullable<number> = null;

  get userLikedListID() {
    return this._userLikedListID;
  }

  async updateUserPlaylistSummary() {}

  async updateUserLikedListSummary() {}

  async updateUserLikedTrackIds() {}

  async getUserPlaylistSummary() {}

  async getUserLikedListSummary() {}

  async getUserLikedTrackIds() {}
}
