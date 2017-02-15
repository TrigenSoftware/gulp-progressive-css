<?php

if (!isset($_GET['file'])) {
	exit();
}

if (isset($_GET['sleep'])) {
	sleep($_GET['sleep']);
}

header("Content-type: text/css");

echo file_get_contents($_GET['file']);
