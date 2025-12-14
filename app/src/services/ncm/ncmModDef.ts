import { createRequire } from "node:module";
import type { ModuleDefinition } from "@neteasecloudmusicapienhanced/api/server.js";

const require = createRequire(import.meta.url);

const moduleDefs: ModuleDefinition[] = [
  {
    identifier: "activate_init_profile",
    route: "/activate/init/profile",
    module: require("@neteasecloudmusicapienhanced/api/module/activate_init_profile")
  },
  {
    identifier: "aidj_content_rcmd",
    route: "/aidj/content/rcmd",
    module: require("@neteasecloudmusicapienhanced/api/module/aidj_content_rcmd")
  },
  {
    identifier: "album_detail_dynamic",
    route: "/album/detail/dynamic",
    module: require("@neteasecloudmusicapienhanced/api/module/album_detail_dynamic")
  },
  {
    identifier: "album_detail",
    route: "/album/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/album_detail")
  },
  {
    identifier: "album_list_style",
    route: "/album/list/style",
    module: require("@neteasecloudmusicapienhanced/api/module/album_list_style")
  },
  {
    identifier: "album_list",
    route: "/album/list",
    module: require("@neteasecloudmusicapienhanced/api/module/album_list")
  },
  {
    identifier: "album_new",
    route: "/album/new",
    module: require("@neteasecloudmusicapienhanced/api/module/album_new")
  },
  {
    identifier: "album_newest",
    route: "/album/newest",
    module: require("@neteasecloudmusicapienhanced/api/module/album_newest")
  },
  {
    identifier: "album_privilege",
    route: "/album/privilege",
    module: require("@neteasecloudmusicapienhanced/api/module/album_privilege")
  },
  {
    identifier: "album_songsaleboard",
    route: "/album/songsaleboard",
    module: require("@neteasecloudmusicapienhanced/api/module/album_songsaleboard")
  },
  {
    identifier: "album_sub",
    route: "/album/sub",
    module: require("@neteasecloudmusicapienhanced/api/module/album_sub")
  },
  {
    identifier: "album_sublist",
    route: "/album/sublist",
    module: require("@neteasecloudmusicapienhanced/api/module/album_sublist")
  },
  {
    identifier: "album",
    route: "/album",
    module: require("@neteasecloudmusicapienhanced/api/module/album")
  },
  {
    identifier: "api",
    route: "/api",
    module: require("@neteasecloudmusicapienhanced/api/module/api")
  },
  {
    identifier: "artist_album",
    route: "/artist/album",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_album")
  },
  {
    identifier: "artist_desc",
    route: "/artist/desc",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_desc")
  },
  {
    identifier: "artist_detail_dynamic",
    route: "/artist/detail/dynamic",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_detail_dynamic")
  },
  {
    identifier: "artist_detail",
    route: "/artist/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_detail")
  },
  {
    identifier: "artist_fans",
    route: "/artist/fans",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_fans")
  },
  {
    identifier: "artist_follow_count",
    route: "/artist/follow/count",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_follow_count")
  },
  {
    identifier: "artist_list",
    route: "/artist/list",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_list")
  },
  {
    identifier: "artist_mv",
    route: "/artist/mv",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_mv")
  },
  {
    identifier: "artist_new_mv",
    route: "/artist/new/mv",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_new_mv")
  },
  {
    identifier: "artist_new_song",
    route: "/artist/new/song",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_new_song")
  },
  {
    identifier: "artist_songs",
    route: "/artist/songs",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_songs")
  },
  {
    identifier: "artist_sub",
    route: "/artist/sub",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_sub")
  },
  {
    identifier: "artist_sublist",
    route: "/artist/sublist",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_sublist")
  },
  {
    identifier: "artist_top_song",
    route: "/artist/top/song",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_top_song")
  },
  {
    identifier: "artist_video",
    route: "/artist/video",
    module: require("@neteasecloudmusicapienhanced/api/module/artist_video")
  },
  {
    identifier: "artists",
    route: "/artists",
    module: require("@neteasecloudmusicapienhanced/api/module/artists")
  },
  {
    identifier: "audio_match",
    route: "/audio/match",
    module: require("@neteasecloudmusicapienhanced/api/module/audio_match")
  },
  {
    identifier: "avatar_upload",
    route: "/avatar/upload",
    module: require("@neteasecloudmusicapienhanced/api/module/avatar_upload")
  },
  {
    identifier: "banner",
    route: "/banner",
    module: require("@neteasecloudmusicapienhanced/api/module/banner")
  },
  {
    identifier: "batch",
    route: "/batch",
    module: require("@neteasecloudmusicapienhanced/api/module/batch")
  },
  {
    identifier: "broadcast_category_region_get",
    route: "/broadcast/category/region/get",
    module: require("@neteasecloudmusicapienhanced/api/module/broadcast_category_region_get")
  },
  {
    identifier: "broadcast_channel_collect_list",
    route: "/broadcast/channel/collect/list",
    module: require("@neteasecloudmusicapienhanced/api/module/broadcast_channel_collect_list")
  },
  {
    identifier: "broadcast_channel_currentinfo",
    route: "/broadcast/channel/currentinfo",
    module: require("@neteasecloudmusicapienhanced/api/module/broadcast_channel_currentinfo")
  },
  {
    identifier: "broadcast_channel_list",
    route: "/broadcast/channel/list",
    module: require("@neteasecloudmusicapienhanced/api/module/broadcast_channel_list")
  },
  {
    identifier: "broadcast_sub",
    route: "/broadcast/sub",
    module: require("@neteasecloudmusicapienhanced/api/module/broadcast_sub")
  },
  {
    identifier: "calendar",
    route: "/calendar",
    module: require("@neteasecloudmusicapienhanced/api/module/calendar")
  },
  {
    identifier: "captcha_sent",
    route: "/captcha/sent",
    module: require("@neteasecloudmusicapienhanced/api/module/captcha_sent")
  },
  {
    identifier: "captcha_verify",
    route: "/captcha/verify",
    module: require("@neteasecloudmusicapienhanced/api/module/captcha_verify")
  },
  {
    identifier: "cellphone_existence_check",
    route: "/cellphone/existence/check",
    module: require("@neteasecloudmusicapienhanced/api/module/cellphone_existence_check")
  },
  {
    identifier: "check_music",
    route: "/check/music",
    module: require("@neteasecloudmusicapienhanced/api/module/check_music")
  },
  {
    identifier: "cloud_import",
    route: "/cloud/import",
    module: require("@neteasecloudmusicapienhanced/api/module/cloud_import")
  },
  {
    identifier: "cloud_lyric_get",
    route: "/cloud/lyric/get",
    module: require("@neteasecloudmusicapienhanced/api/module/cloud_lyric_get")
  },
  {
    identifier: "cloud_match",
    route: "/cloud/match",
    module: require("@neteasecloudmusicapienhanced/api/module/cloud_match")
  },
  {
    identifier: "cloud",
    route: "/cloud",
    module: require("@neteasecloudmusicapienhanced/api/module/cloud")
  },
  {
    identifier: "cloudsearch",
    route: "/cloudsearch",
    module: require("@neteasecloudmusicapienhanced/api/module/cloudsearch")
  },
  {
    identifier: "comment_album",
    route: "/comment/album",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_album")
  },
  {
    identifier: "comment_dj",
    route: "/comment/dj",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_dj")
  },
  {
    identifier: "comment_event",
    route: "/comment/event",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_event")
  },
  {
    identifier: "comment_floor",
    route: "/comment/floor",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_floor")
  },
  {
    identifier: "comment_hot",
    route: "/comment/hot",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_hot")
  },
  {
    identifier: "comment_hug_list",
    route: "/comment/hug/list",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_hug_list")
  },
  {
    identifier: "comment_like",
    route: "/comment/like",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_like")
  },
  {
    identifier: "comment_music",
    route: "/comment/music",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_music")
  },
  {
    identifier: "comment_mv",
    route: "/comment/mv",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_mv")
  },
  {
    identifier: "comment_new",
    route: "/comment/new",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_new")
  },
  {
    identifier: "comment_playlist",
    route: "/comment/playlist",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_playlist")
  },
  {
    identifier: "comment_video",
    route: "/comment/video",
    module: require("@neteasecloudmusicapienhanced/api/module/comment_video")
  },
  {
    identifier: "comment",
    route: "/comment",
    module: require("@neteasecloudmusicapienhanced/api/module/comment")
  },
  {
    identifier: "countries_code_list",
    route: "/countries/code/list",
    module: require("@neteasecloudmusicapienhanced/api/module/countries_code_list")
  },
  {
    identifier: "creator_authinfo_get",
    route: "/creator/authinfo/get",
    module: require("@neteasecloudmusicapienhanced/api/module/creator_authinfo_get")
  },
  {
    identifier: "daily_signin",
    route: "/daily/signin",
    module: require("@neteasecloudmusicapienhanced/api/module/daily_signin")
  },
  {
    identifier: "digitalAlbum_detail",
    route: "/digitalAlbum/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/digitalAlbum_detail")
  },
  {
    identifier: "digitalAlbum_ordering",
    route: "/digitalAlbum/ordering",
    module: require("@neteasecloudmusicapienhanced/api/module/digitalAlbum_ordering")
  },
  {
    identifier: "digitalAlbum_purchased",
    route: "/digitalAlbum/purchased",
    module: require("@neteasecloudmusicapienhanced/api/module/digitalAlbum_purchased")
  },
  {
    identifier: "digitalAlbum_sales",
    route: "/digitalAlbum/sales",
    module: require("@neteasecloudmusicapienhanced/api/module/digitalAlbum_sales")
  },
  {
    identifier: "dj_banner",
    route: "/dj/banner",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_banner")
  },
  {
    identifier: "dj_category_excludehot",
    route: "/dj/category/excludehot",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_category_excludehot")
  },
  {
    identifier: "dj_category_recommend",
    route: "/dj/category/recommend",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_category_recommend")
  },
  {
    identifier: "dj_catelist",
    route: "/dj/catelist",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_catelist")
  },
  {
    identifier: "dj_detail",
    route: "/dj/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_detail")
  },
  {
    identifier: "dj_hot",
    route: "/dj/hot",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_hot")
  },
  {
    identifier: "dj_paygift",
    route: "/dj/paygift",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_paygift")
  },
  {
    identifier: "dj_personalize_recommend",
    route: "/dj/personalize/recommend",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_personalize_recommend")
  },
  {
    identifier: "dj_program_detail",
    route: "/dj/program/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_program_detail")
  },
  {
    identifier: "dj_program_toplist_hours",
    route: "/dj/program/toplist/hours",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_program_toplist_hours")
  },
  {
    identifier: "dj_program_toplist",
    route: "/dj/program/toplist",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_program_toplist")
  },
  {
    identifier: "dj_program",
    route: "/dj/program",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_program")
  },
  {
    identifier: "dj_radio_hot",
    route: "/dj/radio/hot",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_radio_hot")
  },
  {
    identifier: "dj_recommend_type",
    route: "/dj/recommend/type",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_recommend_type")
  },
  {
    identifier: "dj_recommend",
    route: "/dj/recommend",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_recommend")
  },
  {
    identifier: "dj_sub",
    route: "/dj/sub",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_sub")
  },
  {
    identifier: "dj_sublist",
    route: "/dj/sublist",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_sublist")
  },
  {
    identifier: "dj_subscriber",
    route: "/dj/subscriber",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_subscriber")
  },
  {
    identifier: "dj_today_perfered",
    route: "/dj/today/perfered",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_today_perfered")
  },
  {
    identifier: "dj_toplist_hours",
    route: "/dj/toplist/hours",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_toplist_hours")
  },
  {
    identifier: "dj_toplist_newcomer",
    route: "/dj/toplist/newcomer",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_toplist_newcomer")
  },
  {
    identifier: "dj_toplist_pay",
    route: "/dj/toplist/pay",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_toplist_pay")
  },
  {
    identifier: "dj_toplist_popular",
    route: "/dj/toplist/popular",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_toplist_popular")
  },
  {
    identifier: "dj_toplist",
    route: "/dj/toplist",
    module: require("@neteasecloudmusicapienhanced/api/module/dj_toplist")
  },
  {
    identifier: "djRadio_top",
    route: "/djRadio/top",
    module: require("@neteasecloudmusicapienhanced/api/module/djRadio_top")
  },
  {
    identifier: "eapi_decrypt",
    route: "/eapi/decrypt",
    module: require("@neteasecloudmusicapienhanced/api/module/eapi_decrypt")
  },
  {
    identifier: "event_del",
    route: "/event/del",
    module: require("@neteasecloudmusicapienhanced/api/module/event_del")
  },
  {
    identifier: "event_forward",
    route: "/event/forward",
    module: require("@neteasecloudmusicapienhanced/api/module/event_forward")
  },
  {
    identifier: "event",
    route: "/event",
    module: require("@neteasecloudmusicapienhanced/api/module/event")
  },
  {
    identifier: "fanscenter_basicinfo_age_get",
    route: "/fanscenter/basicinfo/age/get",
    module: require("@neteasecloudmusicapienhanced/api/module/fanscenter_basicinfo_age_get")
  },
  {
    identifier: "fanscenter_basicinfo_gender_get",
    route: "/fanscenter/basicinfo/gender/get",
    module: require("@neteasecloudmusicapienhanced/api/module/fanscenter_basicinfo_gender_get")
  },
  {
    identifier: "fanscenter_basicinfo_province_get",
    route: "/fanscenter/basicinfo/province/get",
    module: require("@neteasecloudmusicapienhanced/api/module/fanscenter_basicinfo_province_get")
  },
  {
    identifier: "fanscenter_overview_get",
    route: "/fanscenter/overview/get",
    module: require("@neteasecloudmusicapienhanced/api/module/fanscenter_overview_get")
  },
  {
    identifier: "fanscenter_trend_list",
    route: "/fanscenter/trend/list",
    module: require("@neteasecloudmusicapienhanced/api/module/fanscenter_trend_list")
  },
  {
    identifier: "fm_trash",
    route: "/fm/trash",
    module: require("@neteasecloudmusicapienhanced/api/module/fm_trash")
  },
  {
    identifier: "follow",
    route: "/follow",
    module: require("@neteasecloudmusicapienhanced/api/module/follow")
  },
  {
    identifier: "get_userids",
    route: "/get/userids",
    module: require("@neteasecloudmusicapienhanced/api/module/get_userids")
  },
  {
    identifier: "history_recommend_songs_detail",
    route: "/history/recommend/songs/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/history_recommend_songs_detail")
  },
  {
    identifier: "history_recommend_songs",
    route: "/history/recommend/songs",
    module: require("@neteasecloudmusicapienhanced/api/module/history_recommend_songs")
  },
  {
    identifier: "homepage_block_page",
    route: "/homepage/block/page",
    module: require("@neteasecloudmusicapienhanced/api/module/homepage_block_page")
  },
  {
    identifier: "homepage_dragon_ball",
    route: "/homepage/dragon/ball",
    module: require("@neteasecloudmusicapienhanced/api/module/homepage_dragon_ball")
  },
  {
    identifier: "hot_topic",
    route: "/hot/topic",
    module: require("@neteasecloudmusicapienhanced/api/module/hot_topic")
  },
  {
    identifier: "hug_comment",
    route: "/hug/comment",
    module: require("@neteasecloudmusicapienhanced/api/module/hug_comment")
  },
  {
    identifier: "inner_version",
    route: "/inner/version",
    module: require("@neteasecloudmusicapienhanced/api/module/inner_version")
  },
  {
    identifier: "like",
    route: "/like",
    module: require("@neteasecloudmusicapienhanced/api/module/like")
  },
  {
    identifier: "likelist",
    route: "/likelist",
    module: require("@neteasecloudmusicapienhanced/api/module/likelist")
  },
  {
    identifier: "listen_data_realtime_report",
    route: "/listen/data/realtime/report",
    module: require("@neteasecloudmusicapienhanced/api/module/listen_data_realtime_report")
  },
  {
    identifier: "listen_data_report",
    route: "/listen/data/report",
    module: require("@neteasecloudmusicapienhanced/api/module/listen_data_report")
  },
  {
    identifier: "listen_data_today_song",
    route: "/listen/data/today/song",
    module: require("@neteasecloudmusicapienhanced/api/module/listen_data_today_song")
  },
  {
    identifier: "listen_data_total",
    route: "/listen/data/total",
    module: require("@neteasecloudmusicapienhanced/api/module/listen_data_total")
  },
  {
    identifier: "listen_data_year_report",
    route: "/listen/data/year/report",
    module: require("@neteasecloudmusicapienhanced/api/module/listen_data_year_report")
  },
  {
    identifier: "listentogether_accept",
    route: "/listentogether/accept",
    module: require("@neteasecloudmusicapienhanced/api/module/listentogether_accept")
  },
  {
    identifier: "listentogether_end",
    route: "/listentogether/end",
    module: require("@neteasecloudmusicapienhanced/api/module/listentogether_end")
  },
  {
    identifier: "listentogether_heatbeat",
    route: "/listentogether/heatbeat",
    module: require("@neteasecloudmusicapienhanced/api/module/listentogether_heatbeat")
  },
  {
    identifier: "listentogether_play_command",
    route: "/listentogether/play/command",
    module: require("@neteasecloudmusicapienhanced/api/module/listentogether_play_command")
  },
  {
    identifier: "listentogether_room_check",
    route: "/listentogether/room/check",
    module: require("@neteasecloudmusicapienhanced/api/module/listentogether_room_check")
  },
  {
    identifier: "listentogether_room_create",
    route: "/listentogether/room/create",
    module: require("@neteasecloudmusicapienhanced/api/module/listentogether_room_create")
  },
  {
    identifier: "listentogether_status",
    route: "/listentogether/status",
    module: require("@neteasecloudmusicapienhanced/api/module/listentogether_status")
  },
  {
    identifier: "listentogether_sync_list_command",
    route: "/listentogether/sync/list/command",
    module: require("@neteasecloudmusicapienhanced/api/module/listentogether_sync_list_command")
  },
  {
    identifier: "listentogether_sync_playlist_get",
    route: "/listentogether/sync/playlist/get",
    module: require("@neteasecloudmusicapienhanced/api/module/listentogether_sync_playlist_get")
  },
  {
    identifier: "login_cellphone",
    route: "/login/cellphone",
    module: require("@neteasecloudmusicapienhanced/api/module/login_cellphone")
  },
  {
    identifier: "login_qr_check",
    route: "/login/qr/check",
    module: require("@neteasecloudmusicapienhanced/api/module/login_qr_check")
  },
  {
    identifier: "login_qr_create",
    route: "/login/qr/create",
    module: require("@neteasecloudmusicapienhanced/api/module/login_qr_create")
  },
  {
    identifier: "login_qr_key",
    route: "/login/qr/key",
    module: require("@neteasecloudmusicapienhanced/api/module/login_qr_key")
  },
  {
    identifier: "login_refresh",
    route: "/login/refresh",
    module: require("@neteasecloudmusicapienhanced/api/module/login_refresh")
  },
  {
    identifier: "login_status",
    route: "/login/status",
    module: require("@neteasecloudmusicapienhanced/api/module/login_status")
  },
  {
    identifier: "login",
    route: "/login",
    module: require("@neteasecloudmusicapienhanced/api/module/login")
  },
  {
    identifier: "logout",
    route: "/logout",
    module: require("@neteasecloudmusicapienhanced/api/module/logout")
  },
  {
    identifier: "lyric_new",
    route: "/lyric/new",
    module: require("@neteasecloudmusicapienhanced/api/module/lyric_new")
  },
  {
    identifier: "lyric",
    route: "/lyric",
    module: require("@neteasecloudmusicapienhanced/api/module/lyric")
  },
  {
    identifier: "mlog_music_rcmd",
    route: "/mlog/music/rcmd",
    module: require("@neteasecloudmusicapienhanced/api/module/mlog_music_rcmd")
  },
  {
    identifier: "mlog_to_video",
    route: "/mlog/to/video",
    module: require("@neteasecloudmusicapienhanced/api/module/mlog_to_video")
  },
  {
    identifier: "mlog_url",
    route: "/mlog/url",
    module: require("@neteasecloudmusicapienhanced/api/module/mlog_url")
  },
  {
    identifier: "msg_comments",
    route: "/msg/comments",
    module: require("@neteasecloudmusicapienhanced/api/module/msg_comments")
  },
  {
    identifier: "msg_forwards",
    route: "/msg/forwards",
    module: require("@neteasecloudmusicapienhanced/api/module/msg_forwards")
  },
  {
    identifier: "msg_notices",
    route: "/msg/notices",
    module: require("@neteasecloudmusicapienhanced/api/module/msg_notices")
  },
  {
    identifier: "msg_private_history",
    route: "/msg/private/history",
    module: require("@neteasecloudmusicapienhanced/api/module/msg_private_history")
  },
  {
    identifier: "msg_private",
    route: "/msg/private",
    module: require("@neteasecloudmusicapienhanced/api/module/msg_private")
  },
  {
    identifier: "msg_recentcontact",
    route: "/msg/recentcontact",
    module: require("@neteasecloudmusicapienhanced/api/module/msg_recentcontact")
  },
  {
    identifier: "music_first_listen_info",
    route: "/music/first/listen/info",
    module: require("@neteasecloudmusicapienhanced/api/module/music_first_listen_info")
  },
  {
    identifier: "musician_cloudbean_obtain",
    route: "/musician/cloudbean/obtain",
    module: require("@neteasecloudmusicapienhanced/api/module/musician_cloudbean_obtain")
  },
  {
    identifier: "musician_cloudbean",
    route: "/musician/cloudbean",
    module: require("@neteasecloudmusicapienhanced/api/module/musician_cloudbean")
  },
  {
    identifier: "musician_data_overview",
    route: "/musician/data/overview",
    module: require("@neteasecloudmusicapienhanced/api/module/musician_data_overview")
  },
  {
    identifier: "musician_play_trend",
    route: "/musician/play/trend",
    module: require("@neteasecloudmusicapienhanced/api/module/musician_play_trend")
  },
  {
    identifier: "musician_sign",
    route: "/musician/sign",
    module: require("@neteasecloudmusicapienhanced/api/module/musician_sign")
  },
  {
    identifier: "musician_tasks_new",
    route: "/musician/tasks/new",
    module: require("@neteasecloudmusicapienhanced/api/module/musician_tasks_new")
  },
  {
    identifier: "musician_tasks",
    route: "/musician/tasks",
    module: require("@neteasecloudmusicapienhanced/api/module/musician_tasks")
  },
  {
    identifier: "mv_all",
    route: "/mv/all",
    module: require("@neteasecloudmusicapienhanced/api/module/mv_all")
  },
  {
    identifier: "mv_detail_info",
    route: "/mv/detail/info",
    module: require("@neteasecloudmusicapienhanced/api/module/mv_detail_info")
  },
  {
    identifier: "mv_detail",
    route: "/mv/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/mv_detail")
  },
  {
    identifier: "mv_exclusive_rcmd",
    route: "/mv/exclusive/rcmd",
    module: require("@neteasecloudmusicapienhanced/api/module/mv_exclusive_rcmd")
  },
  {
    identifier: "mv_first",
    route: "/mv/first",
    module: require("@neteasecloudmusicapienhanced/api/module/mv_first")
  },
  {
    identifier: "mv_sub",
    route: "/mv/sub",
    module: require("@neteasecloudmusicapienhanced/api/module/mv_sub")
  },
  {
    identifier: "mv_sublist",
    route: "/mv/sublist",
    module: require("@neteasecloudmusicapienhanced/api/module/mv_sublist")
  },
  {
    identifier: "mv_url",
    route: "/mv/url",
    module: require("@neteasecloudmusicapienhanced/api/module/mv_url")
  },
  {
    identifier: "nickname_check",
    route: "/nickname/check",
    module: require("@neteasecloudmusicapienhanced/api/module/nickname_check")
  },
  {
    identifier: "personal_fm_mode",
    route: "/personal/fm/mode",
    module: require("@neteasecloudmusicapienhanced/api/module/personal_fm_mode")
  },
  {
    identifier: "personal_fm",
    route: "/personal/fm",
    module: require("@neteasecloudmusicapienhanced/api/module/personal_fm")
  },
  {
    identifier: "personalized_djprogram",
    route: "/personalized/djprogram",
    module: require("@neteasecloudmusicapienhanced/api/module/personalized_djprogram")
  },
  {
    identifier: "personalized_mv",
    route: "/personalized/mv",
    module: require("@neteasecloudmusicapienhanced/api/module/personalized_mv")
  },
  {
    identifier: "personalized_newsong",
    route: "/personalized/newsong",
    module: require("@neteasecloudmusicapienhanced/api/module/personalized_newsong")
  },
  {
    identifier: "personalized_privatecontent_list",
    route: "/personalized/privatecontent/list",
    module: require("@neteasecloudmusicapienhanced/api/module/personalized_privatecontent_list")
  },
  {
    identifier: "personalized_privatecontent",
    route: "/personalized/privatecontent",
    module: require("@neteasecloudmusicapienhanced/api/module/personalized_privatecontent")
  },
  {
    identifier: "personalized",
    route: "/personalized",
    module: require("@neteasecloudmusicapienhanced/api/module/personalized")
  },
  {
    identifier: "pl_count",
    route: "/pl/count",
    module: require("@neteasecloudmusicapienhanced/api/module/pl_count")
  },
  {
    identifier: "playlist_category_list",
    route: "/playlist/category/list",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_category_list")
  },
  {
    identifier: "playlist_catlist",
    route: "/playlist/catlist",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_catlist")
  },
  {
    identifier: "playlist_cover_update",
    route: "/playlist/cover/update",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_cover_update")
  },
  {
    identifier: "playlist_create",
    route: "/playlist/create",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_create")
  },
  {
    identifier: "playlist_delete",
    route: "/playlist/delete",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_delete")
  },
  {
    identifier: "playlist_desc_update",
    route: "/playlist/desc/update",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_desc_update")
  },
  {
    identifier: "playlist_detail_dynamic",
    route: "/playlist/detail/dynamic",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_detail_dynamic")
  },
  {
    identifier: "playlist_detail_rcmd_get",
    route: "/playlist/detail/rcmd/get",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_detail_rcmd_get")
  },
  {
    identifier: "playlist_detail",
    route: "/playlist/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_detail")
  },
  {
    identifier: "playlist_highquality_tags",
    route: "/playlist/highquality/tags",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_highquality_tags")
  },
  {
    identifier: "playlist_hot",
    route: "/playlist/hot",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_hot")
  },
  {
    identifier: "playlist_import_name_task_create",
    route: "/playlist/import/name/task/create",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_import_name_task_create")
  },
  {
    identifier: "playlist_import_task_status",
    route: "/playlist/import/task/status",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_import_task_status")
  },
  {
    identifier: "playlist_mylike",
    route: "/playlist/mylike",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_mylike")
  },
  {
    identifier: "playlist_name_update",
    route: "/playlist/name/update",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_name_update")
  },
  {
    identifier: "playlist_order_update",
    route: "/playlist/order/update",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_order_update")
  },
  {
    identifier: "playlist_privacy",
    route: "/playlist/privacy",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_privacy")
  },
  {
    identifier: "playlist_subscribe",
    route: "/playlist/subscribe",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_subscribe")
  },
  {
    identifier: "playlist_subscribers",
    route: "/playlist/subscribers",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_subscribers")
  },
  {
    identifier: "playlist_tags_update",
    route: "/playlist/tags/update",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_tags_update")
  },
  {
    identifier: "playlist_track_add",
    route: "/playlist/track/add",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_track_add")
  },
  {
    identifier: "playlist_track_all",
    route: "/playlist/track/all",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_track_all")
  },
  {
    identifier: "playlist_track_delete",
    route: "/playlist/track/delete",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_track_delete")
  },
  {
    identifier: "playlist_tracks",
    route: "/playlist/tracks",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_tracks")
  },
  {
    identifier: "playlist_update_playcount",
    route: "/playlist/update/playcount",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_update_playcount")
  },
  {
    identifier: "playlist_update",
    route: "/playlist/update",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_update")
  },
  {
    identifier: "playlist_video_recent",
    route: "/playlist/video/recent",
    module: require("@neteasecloudmusicapienhanced/api/module/playlist_video_recent")
  },
  {
    identifier: "playmode_intelligence_list",
    route: "/playmode/intelligence/list",
    module: require("@neteasecloudmusicapienhanced/api/module/playmode_intelligence_list")
  },
  {
    identifier: "playmode_song_vector",
    route: "/playmode/song/vector",
    module: require("@neteasecloudmusicapienhanced/api/module/playmode_song_vector")
  },
  {
    identifier: "program_recommend",
    route: "/program/recommend",
    module: require("@neteasecloudmusicapienhanced/api/module/program_recommend")
  },
  {
    identifier: "rebind",
    route: "/rebind",
    module: require("@neteasecloudmusicapienhanced/api/module/rebind")
  },
  {
    identifier: "recent_listen_list",
    route: "/recent/listen/list",
    module: require("@neteasecloudmusicapienhanced/api/module/recent_listen_list")
  },
  {
    identifier: "recommend_resource",
    route: "/recommend/resource",
    module: require("@neteasecloudmusicapienhanced/api/module/recommend_resource")
  },
  {
    identifier: "recommend_songs_dislike",
    route: "/recommend/songs/dislike",
    module: require("@neteasecloudmusicapienhanced/api/module/recommend_songs_dislike")
  },
  {
    identifier: "recommend_songs",
    route: "/recommend/songs",
    module: require("@neteasecloudmusicapienhanced/api/module/recommend_songs")
  },
  {
    identifier: "record_recent_album",
    route: "/record/recent/album",
    module: require("@neteasecloudmusicapienhanced/api/module/record_recent_album")
  },
  {
    identifier: "record_recent_dj",
    route: "/record/recent/dj",
    module: require("@neteasecloudmusicapienhanced/api/module/record_recent_dj")
  },
  {
    identifier: "record_recent_playlist",
    route: "/record/recent/playlist",
    module: require("@neteasecloudmusicapienhanced/api/module/record_recent_playlist")
  },
  {
    identifier: "record_recent_song",
    route: "/record/recent/song",
    module: require("@neteasecloudmusicapienhanced/api/module/record_recent_song")
  },
  {
    identifier: "record_recent_video",
    route: "/record/recent/video",
    module: require("@neteasecloudmusicapienhanced/api/module/record_recent_video")
  },
  {
    identifier: "record_recent_voice",
    route: "/record/recent/voice",
    module: require("@neteasecloudmusicapienhanced/api/module/record_recent_voice")
  },
  {
    identifier: "register_anonimous",
    route: "/register/anonimous",
    module: require("@neteasecloudmusicapienhanced/api/module/register_anonimous")
  },
  {
    identifier: "register_cellphone",
    route: "/register/cellphone",
    module: require("@neteasecloudmusicapienhanced/api/module/register_cellphone")
  },
  {
    identifier: "related_allvideo",
    route: "/related/allvideo",
    module: require("@neteasecloudmusicapienhanced/api/module/related_allvideo")
  },
  {
    identifier: "related_playlist",
    route: "/related/playlist",
    module: require("@neteasecloudmusicapienhanced/api/module/related_playlist")
  },
  {
    identifier: "resource_like",
    route: "/resource/like",
    module: require("@neteasecloudmusicapienhanced/api/module/resource_like")
  },
  {
    identifier: "scrobble",
    route: "/scrobble",
    module: require("@neteasecloudmusicapienhanced/api/module/scrobble")
  },
  {
    identifier: "search_default",
    route: "/search/default",
    module: require("@neteasecloudmusicapienhanced/api/module/search_default")
  },
  {
    identifier: "search_hot_detail",
    route: "/search/hot/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/search_hot_detail")
  },
  {
    identifier: "search_hot",
    route: "/search/hot",
    module: require("@neteasecloudmusicapienhanced/api/module/search_hot")
  },
  {
    identifier: "search_match",
    route: "/search/match",
    module: require("@neteasecloudmusicapienhanced/api/module/search_match")
  },
  {
    identifier: "search_multimatch",
    route: "/search/multimatch",
    module: require("@neteasecloudmusicapienhanced/api/module/search_multimatch")
  },
  {
    identifier: "search_suggest",
    route: "/search/suggest",
    module: require("@neteasecloudmusicapienhanced/api/module/search_suggest")
  },
  {
    identifier: "search",
    route: "/search",
    module: require("@neteasecloudmusicapienhanced/api/module/search")
  },
  {
    identifier: "send_album",
    route: "/send/album",
    module: require("@neteasecloudmusicapienhanced/api/module/send_album")
  },
  {
    identifier: "send_playlist",
    route: "/send/playlist",
    module: require("@neteasecloudmusicapienhanced/api/module/send_playlist")
  },
  {
    identifier: "send_song",
    route: "/send/song",
    module: require("@neteasecloudmusicapienhanced/api/module/send_song")
  },
  {
    identifier: "send_text",
    route: "/send/text",
    module: require("@neteasecloudmusicapienhanced/api/module/send_text")
  },
  {
    identifier: "setting",
    route: "/setting",
    module: require("@neteasecloudmusicapienhanced/api/module/setting")
  },
  {
    identifier: "share_resource",
    route: "/share/resource",
    module: require("@neteasecloudmusicapienhanced/api/module/share_resource")
  },
  {
    identifier: "sheet_list",
    route: "/sheet/list",
    module: require("@neteasecloudmusicapienhanced/api/module/sheet_list")
  },
  {
    identifier: "sheet_preview",
    route: "/sheet/preview",
    module: require("@neteasecloudmusicapienhanced/api/module/sheet_preview")
  },
  {
    identifier: "sign_happy_info",
    route: "/sign/happy/info",
    module: require("@neteasecloudmusicapienhanced/api/module/sign_happy_info")
  },
  {
    identifier: "signin_progress",
    route: "/signin/progress",
    module: require("@neteasecloudmusicapienhanced/api/module/signin_progress")
  },
  {
    identifier: "simi_artist",
    route: "/simi/artist",
    module: require("@neteasecloudmusicapienhanced/api/module/simi_artist")
  },
  {
    identifier: "simi_mv",
    route: "/simi/mv",
    module: require("@neteasecloudmusicapienhanced/api/module/simi_mv")
  },
  {
    identifier: "simi_playlist",
    route: "/simi/playlist",
    module: require("@neteasecloudmusicapienhanced/api/module/simi_playlist")
  },
  {
    identifier: "simi_song",
    route: "/simi/song",
    module: require("@neteasecloudmusicapienhanced/api/module/simi_song")
  },
  {
    identifier: "simi_user",
    route: "/simi/user",
    module: require("@neteasecloudmusicapienhanced/api/module/simi_user")
  },
  {
    identifier: "song_chorus",
    route: "/song/chorus",
    module: require("@neteasecloudmusicapienhanced/api/module/song_chorus")
  },
  {
    identifier: "song_detail",
    route: "/song/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/song_detail")
  },
  {
    identifier: "song_downlist",
    route: "/song/downlist",
    module: require("@neteasecloudmusicapienhanced/api/module/song_downlist")
  },
  {
    identifier: "song_download_url_v1",
    route: "/song/download/url/v1",
    module: require("@neteasecloudmusicapienhanced/api/module/song_download_url_v1")
  },
  {
    identifier: "song_download_url",
    route: "/song/download/url",
    module: require("@neteasecloudmusicapienhanced/api/module/song_download_url")
  },
  {
    identifier: "song_dynamic_cover",
    route: "/song/dynamic/cover",
    module: require("@neteasecloudmusicapienhanced/api/module/song_dynamic_cover")
  },
  {
    identifier: "song_like_check",
    route: "/song/like/check",
    module: require("@neteasecloudmusicapienhanced/api/module/song_like_check")
  },
  {
    identifier: "song_lyrics_mark_add",
    route: "/song/lyrics/mark/add",
    module: require("@neteasecloudmusicapienhanced/api/module/song_lyrics_mark_add")
  },
  {
    identifier: "song_lyrics_mark_del",
    route: "/song/lyrics/mark/del",
    module: require("@neteasecloudmusicapienhanced/api/module/song_lyrics_mark_del")
  },
  {
    identifier: "song_lyrics_mark_user_page",
    route: "/song/lyrics/mark/user/page",
    module: require("@neteasecloudmusicapienhanced/api/module/song_lyrics_mark_user_page")
  },
  {
    identifier: "song_lyrics_mark",
    route: "/song/lyrics/mark",
    module: require("@neteasecloudmusicapienhanced/api/module/song_lyrics_mark")
  },
  {
    identifier: "song_monthdownlist",
    route: "/song/monthdownlist",
    module: require("@neteasecloudmusicapienhanced/api/module/song_monthdownlist")
  },
  {
    identifier: "song_music_detail",
    route: "/song/music/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/song_music_detail")
  },
  {
    identifier: "song_order_update",
    route: "/song/order/update",
    module: require("@neteasecloudmusicapienhanced/api/module/song_order_update")
  },
  {
    identifier: "song_purchased",
    route: "/song/purchased",
    module: require("@neteasecloudmusicapienhanced/api/module/song_purchased")
  },
  {
    identifier: "song_red_count",
    route: "/song/red/count",
    module: require("@neteasecloudmusicapienhanced/api/module/song_red_count")
  },
  {
    identifier: "song_singledownlist",
    route: "/song/singledownlist",
    module: require("@neteasecloudmusicapienhanced/api/module/song_singledownlist")
  },
  {
    identifier: "song_url_match",
    route: "/song/url/match",
    module: require("@neteasecloudmusicapienhanced/api/module/song_url_match")
  },
  {
    identifier: "song_url_ncmget",
    route: "/song/url/ncmget",
    module: require("@neteasecloudmusicapienhanced/api/module/song_url_ncmget")
  },
  {
    identifier: "song_url_unblock",
    route: "/song/url/unblock",
    module: require("@neteasecloudmusicapienhanced/api/module/song_url_unblock")
  },
  {
    identifier: "song_url_v1",
    route: "/song/url/v1",
    module: require("@neteasecloudmusicapienhanced/api/module/song_url_v1")
  },
  {
    identifier: "song_url",
    route: "/song/url",
    module: require("@neteasecloudmusicapienhanced/api/module/song_url")
  },
  {
    identifier: "song_wiki_summary",
    route: "/song/wiki/summary",
    module: require("@neteasecloudmusicapienhanced/api/module/song_wiki_summary")
  },
  {
    identifier: "starpick_comments_summary",
    route: "/starpick/comments/summary",
    module: require("@neteasecloudmusicapienhanced/api/module/starpick_comments_summary")
  },
  {
    identifier: "style_album",
    route: "/style/album",
    module: require("@neteasecloudmusicapienhanced/api/module/style_album")
  },
  {
    identifier: "style_artist",
    route: "/style/artist",
    module: require("@neteasecloudmusicapienhanced/api/module/style_artist")
  },
  {
    identifier: "style_detail",
    route: "/style/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/style_detail")
  },
  {
    identifier: "style_list",
    route: "/style/list",
    module: require("@neteasecloudmusicapienhanced/api/module/style_list")
  },
  {
    identifier: "style_playlist",
    route: "/style/playlist",
    module: require("@neteasecloudmusicapienhanced/api/module/style_playlist")
  },
  {
    identifier: "style_preference",
    route: "/style/preference",
    module: require("@neteasecloudmusicapienhanced/api/module/style_preference")
  },
  {
    identifier: "style_song",
    route: "/style/song",
    module: require("@neteasecloudmusicapienhanced/api/module/style_song")
  },
  {
    identifier: "summary_annual",
    route: "/summary/annual",
    module: require("@neteasecloudmusicapienhanced/api/module/summary_annual")
  },
  {
    identifier: "threshold_detail_get",
    route: "/threshold/detail/get",
    module: require("@neteasecloudmusicapienhanced/api/module/threshold_detail_get")
  },
  {
    identifier: "top_album",
    route: "/top/album",
    module: require("@neteasecloudmusicapienhanced/api/module/top_album")
  },
  {
    identifier: "top_artists",
    route: "/top/artists",
    module: require("@neteasecloudmusicapienhanced/api/module/top_artists")
  },
  {
    identifier: "top_list",
    route: "/top/list",
    module: require("@neteasecloudmusicapienhanced/api/module/top_list")
  },
  {
    identifier: "top_mv",
    route: "/top/mv",
    module: require("@neteasecloudmusicapienhanced/api/module/top_mv")
  },
  {
    identifier: "top_playlist_highquality",
    route: "/top/playlist/highquality",
    module: require("@neteasecloudmusicapienhanced/api/module/top_playlist_highquality")
  },
  {
    identifier: "top_playlist",
    route: "/top/playlist",
    module: require("@neteasecloudmusicapienhanced/api/module/top_playlist")
  },
  {
    identifier: "top_song",
    route: "/top/song",
    module: require("@neteasecloudmusicapienhanced/api/module/top_song")
  },
  {
    identifier: "topic_detail_event_hot",
    route: "/topic/detail/event/hot",
    module: require("@neteasecloudmusicapienhanced/api/module/topic_detail_event_hot")
  },
  {
    identifier: "topic_detail",
    route: "/topic/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/topic_detail")
  },
  {
    identifier: "topic_sublist",
    route: "/topic/sublist",
    module: require("@neteasecloudmusicapienhanced/api/module/topic_sublist")
  },
  {
    identifier: "toplist_artist",
    route: "/toplist/artist",
    module: require("@neteasecloudmusicapienhanced/api/module/toplist_artist")
  },
  {
    identifier: "toplist_detail_v2",
    route: "/toplist/detail/v2",
    module: require("@neteasecloudmusicapienhanced/api/module/toplist_detail_v2")
  },
  {
    identifier: "toplist_detail",
    route: "/toplist/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/toplist_detail")
  },
  {
    identifier: "toplist",
    route: "/toplist",
    module: require("@neteasecloudmusicapienhanced/api/module/toplist")
  },
  {
    identifier: "ugc_album_get",
    route: "/ugc/album/get",
    module: require("@neteasecloudmusicapienhanced/api/module/ugc_album_get")
  },
  {
    identifier: "ugc_artist_get",
    route: "/ugc/artist/get",
    module: require("@neteasecloudmusicapienhanced/api/module/ugc_artist_get")
  },
  {
    identifier: "ugc_artist_search",
    route: "/ugc/artist/search",
    module: require("@neteasecloudmusicapienhanced/api/module/ugc_artist_search")
  },
  {
    identifier: "ugc_detail",
    route: "/ugc/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/ugc_detail")
  },
  {
    identifier: "ugc_mv_get",
    route: "/ugc/mv/get",
    module: require("@neteasecloudmusicapienhanced/api/module/ugc_mv_get")
  },
  {
    identifier: "ugc_song_get",
    route: "/ugc/song/get",
    module: require("@neteasecloudmusicapienhanced/api/module/ugc_song_get")
  },
  {
    identifier: "ugc_user_devote",
    route: "/ugc/user/devote",
    module: require("@neteasecloudmusicapienhanced/api/module/ugc_user_devote")
  },
  {
    identifier: "user_account",
    route: "/user/account",
    module: require("@neteasecloudmusicapienhanced/api/module/user_account")
  },
  {
    identifier: "user_audio",
    route: "/user/audio",
    module: require("@neteasecloudmusicapienhanced/api/module/user_audio")
  },
  {
    identifier: "user_binding",
    route: "/user/binding",
    module: require("@neteasecloudmusicapienhanced/api/module/user_binding")
  },
  {
    identifier: "user_bindingcellphone",
    route: "/user/bindingcellphone",
    module: require("@neteasecloudmusicapienhanced/api/module/user_bindingcellphone")
  },
  {
    identifier: "user_cloud_del",
    route: "/user/cloud/del",
    module: require("@neteasecloudmusicapienhanced/api/module/user_cloud_del")
  },
  {
    identifier: "user_cloud_detail",
    route: "/user/cloud/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/user_cloud_detail")
  },
  {
    identifier: "user_cloud",
    route: "/user/cloud",
    module: require("@neteasecloudmusicapienhanced/api/module/user_cloud")
  },
  {
    identifier: "user_comment_history",
    route: "/user/comment/history",
    module: require("@neteasecloudmusicapienhanced/api/module/user_comment_history")
  },
  {
    identifier: "user_detail_new",
    route: "/user/detail/new",
    module: require("@neteasecloudmusicapienhanced/api/module/user_detail_new")
  },
  {
    identifier: "user_detail",
    route: "/user/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/user_detail")
  },
  {
    identifier: "user_dj",
    route: "/user/dj",
    module: require("@neteasecloudmusicapienhanced/api/module/user_dj")
  },
  {
    identifier: "user_event",
    route: "/user/event",
    module: require("@neteasecloudmusicapienhanced/api/module/user_event")
  },
  {
    identifier: "user_follow_mixed",
    route: "/user/follow/mixed",
    module: require("@neteasecloudmusicapienhanced/api/module/user_follow_mixed")
  },
  {
    identifier: "user_followeds",
    route: "/user/followeds",
    module: require("@neteasecloudmusicapienhanced/api/module/user_followeds")
  },
  {
    identifier: "user_follows",
    route: "/user/follows",
    module: require("@neteasecloudmusicapienhanced/api/module/user_follows")
  },
  {
    identifier: "user_level",
    route: "/user/level",
    module: require("@neteasecloudmusicapienhanced/api/module/user_level")
  },
  {
    identifier: "user_medal",
    route: "/user/medal",
    module: require("@neteasecloudmusicapienhanced/api/module/user_medal")
  },
  {
    identifier: "user_mutualfollow_get",
    route: "/user/mutualfollow/get",
    module: require("@neteasecloudmusicapienhanced/api/module/user_mutualfollow_get")
  },
  {
    identifier: "user_playlist",
    route: "/user/playlist",
    module: require("@neteasecloudmusicapienhanced/api/module/user_playlist")
  },
  {
    identifier: "user_record",
    route: "/user/record",
    module: require("@neteasecloudmusicapienhanced/api/module/user_record")
  },
  {
    identifier: "user_replacephone",
    route: "/user/replacephone",
    module: require("@neteasecloudmusicapienhanced/api/module/user_replacephone")
  },
  {
    identifier: "user_social_status_edit",
    route: "/user/social/status/edit",
    module: require("@neteasecloudmusicapienhanced/api/module/user_social_status_edit")
  },
  {
    identifier: "user_social_status_rcmd",
    route: "/user/social/status/rcmd",
    module: require("@neteasecloudmusicapienhanced/api/module/user_social_status_rcmd")
  },
  {
    identifier: "user_social_status_support",
    route: "/user/social/status/support",
    module: require("@neteasecloudmusicapienhanced/api/module/user_social_status_support")
  },
  {
    identifier: "user_social_status",
    route: "/user/social/status",
    module: require("@neteasecloudmusicapienhanced/api/module/user_social_status")
  },
  {
    identifier: "user_subcount",
    route: "/user/subcount",
    module: require("@neteasecloudmusicapienhanced/api/module/user_subcount")
  },
  {
    identifier: "user_update",
    route: "/user/update",
    module: require("@neteasecloudmusicapienhanced/api/module/user_update")
  },
  {
    identifier: "verify_getQr",
    route: "/verify/getQr",
    module: require("@neteasecloudmusicapienhanced/api/module/verify_getQr")
  },
  {
    identifier: "verify_qrcodestatus",
    route: "/verify/qrcodestatus",
    module: require("@neteasecloudmusicapienhanced/api/module/verify_qrcodestatus")
  },
  {
    identifier: "video_category_list",
    route: "/video/category/list",
    module: require("@neteasecloudmusicapienhanced/api/module/video_category_list")
  },
  {
    identifier: "video_detail_info",
    route: "/video/detail/info",
    module: require("@neteasecloudmusicapienhanced/api/module/video_detail_info")
  },
  {
    identifier: "video_detail",
    route: "/video/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/video_detail")
  },
  {
    identifier: "video_group_list",
    route: "/video/group/list",
    module: require("@neteasecloudmusicapienhanced/api/module/video_group_list")
  },
  {
    identifier: "video_group",
    route: "/video/group",
    module: require("@neteasecloudmusicapienhanced/api/module/video_group")
  },
  {
    identifier: "video_sub",
    route: "/video/sub",
    module: require("@neteasecloudmusicapienhanced/api/module/video_sub")
  },
  {
    identifier: "video_timeline_all",
    route: "/video/timeline/all",
    module: require("@neteasecloudmusicapienhanced/api/module/video_timeline_all")
  },
  {
    identifier: "video_timeline_recommend",
    route: "/video/timeline/recommend",
    module: require("@neteasecloudmusicapienhanced/api/module/video_timeline_recommend")
  },
  {
    identifier: "video_url",
    route: "/video/url",
    module: require("@neteasecloudmusicapienhanced/api/module/video_url")
  },
  {
    identifier: "vip_growthpoint_details",
    route: "/vip/growthpoint/details",
    module: require("@neteasecloudmusicapienhanced/api/module/vip_growthpoint_details")
  },
  {
    identifier: "vip_growthpoint_get",
    route: "/vip/growthpoint/get",
    module: require("@neteasecloudmusicapienhanced/api/module/vip_growthpoint_get")
  },
  {
    identifier: "vip_growthpoint",
    route: "/vip/growthpoint",
    module: require("@neteasecloudmusicapienhanced/api/module/vip_growthpoint")
  },
  {
    identifier: "vip_info_v2",
    route: "/vip/info/v2",
    module: require("@neteasecloudmusicapienhanced/api/module/vip_info_v2")
  },
  {
    identifier: "vip_info",
    route: "/vip/info",
    module: require("@neteasecloudmusicapienhanced/api/module/vip_info")
  },
  {
    identifier: "vip_tasks",
    route: "/vip/tasks",
    module: require("@neteasecloudmusicapienhanced/api/module/vip_tasks")
  },
  {
    identifier: "vip_timemachine",
    route: "/vip/timemachine",
    module: require("@neteasecloudmusicapienhanced/api/module/vip_timemachine")
  },
  {
    identifier: "voice_delete",
    route: "/voice/delete",
    module: require("@neteasecloudmusicapienhanced/api/module/voice_delete")
  },
  {
    identifier: "voice_detail",
    route: "/voice/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/voice_detail")
  },
  {
    identifier: "voice_lyric",
    route: "/voice/lyric",
    module: require("@neteasecloudmusicapienhanced/api/module/voice_lyric")
  },
  {
    identifier: "voice_upload",
    route: "/voice/upload",
    module: require("@neteasecloudmusicapienhanced/api/module/voice_upload")
  },
  {
    identifier: "voicelist_detail",
    route: "/voicelist/detail",
    module: require("@neteasecloudmusicapienhanced/api/module/voicelist_detail")
  },
  {
    identifier: "voicelist_list_search",
    route: "/voicelist/list/search",
    module: require("@neteasecloudmusicapienhanced/api/module/voicelist_list_search")
  },
  {
    identifier: "voicelist_list",
    route: "/voicelist/list",
    module: require("@neteasecloudmusicapienhanced/api/module/voicelist_list")
  },
  {
    identifier: "voicelist_search",
    route: "/voicelist/search",
    module: require("@neteasecloudmusicapienhanced/api/module/voicelist_search")
  },
  {
    identifier: "voicelist_trans",
    route: "/voicelist/trans",
    module: require("@neteasecloudmusicapienhanced/api/module/voicelist_trans")
  },
  {
    identifier: "weblog",
    route: "/weblog",
    module: require("@neteasecloudmusicapienhanced/api/module/weblog")
  },
  {
    identifier: "yunbei_expense",
    route: "/yunbei/expense",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_expense")
  },
  {
    identifier: "yunbei_info",
    route: "/yunbei/info",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_info")
  },
  {
    identifier: "yunbei_rcmd_song_history",
    route: "/yunbei/rcmd/song/history",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_rcmd_song_history")
  },
  {
    identifier: "yunbei_rcmd_song",
    route: "/yunbei/rcmd/song",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_rcmd_song")
  },
  {
    identifier: "yunbei_receipt",
    route: "/yunbei/receipt",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_receipt")
  },
  {
    identifier: "yunbei_sign",
    route: "/yunbei/sign",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_sign")
  },
  {
    identifier: "yunbei_task_finish",
    route: "/yunbei/task/finish",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_task_finish")
  },
  {
    identifier: "yunbei_tasks_todo",
    route: "/yunbei/tasks/todo",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_tasks_todo")
  },
  {
    identifier: "yunbei_tasks",
    route: "/yunbei/tasks",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_tasks")
  },
  {
    identifier: "yunbei_today",
    route: "/yunbei/today",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei_today")
  },
  {
    identifier: "yunbei",
    route: "/yunbei",
    module: require("@neteasecloudmusicapienhanced/api/module/yunbei")
  }
];

export default moduleDefs;
