<?php

if (!isset($_GET['file'])) {
	exit();
}

header("Content-type: text/css");

$lastModified_unix = filemtime($_GET['file']);
$lastModified = gmdate("D, d M Y H:i:s \G\M\T", $lastModified_unix);
$ifModifiedSince = false;

if (isset($_ENV['HTTP_IF_MODIFIED_SINCE'])) {
    $ifModifiedSince = strtotime(substr($_ENV['HTTP_IF_MODIFIED_SINCE'], 5));  
}

if (isset($_SERVER['HTTP_IF_MODIFIED_SINCE'])) {
    $ifModifiedSince = strtotime(substr($_SERVER['HTTP_IF_MODIFIED_SINCE'], 5));
}

if ($ifModifiedSince && $ifModifiedSince >= $lastModified_unix) {
    header($_SERVER['SERVER_PROTOCOL'] . ' 304 Not Modified');
    exit;
}

if (isset($_GET['sleep'])) {
	sleep($_GET['sleep']);
}

header('Last-Modified: '. $lastModified);

echo file_get_contents($_GET['file']);
