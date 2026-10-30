<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Literasi Kesiapsiagaan Bencana</title>
    <link rel="stylesheet" href="<?= base_url() ?>assets/plugin_video/css/bootstrap.min.css">
    <link rel="stylesheet" href="<?= base_url() ?>assets/plugin_video/fontawesome/css/all.min.css">
    <link rel="stylesheet" href="<?= base_url() ?>assets/plugin_video/css/templatemo-style.css">
    <!--
    
TemplateMo 556 Catalog-Z

https://templatemo.com/tm-556-catalog-z

-->
</head>

<body>
    <!-- Page Loader -->
    <div id="loader-wrapper">
        <div id="loader"></div>

        <div class="loader-section section-left"></div>
        <div class="loader-section section-right"></div>

    </div>
    <nav class="navbar navbar-expand-lg">
        <div class="container-fluid">
            <a class="navbar-brand" href="index.html">
                <i class="fas fa-film mr-2"></i>
                <?= $this->session->userdata('nama_user'); ?>
            </a>
            <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                <i class="fas fa-bars"></i>
            </button>
            <div class="collapse navbar-collapse" id="navbarSupportedContent">
                <ul class="navbar-nav ml-auto mb-2 mb-lg-0">
                    <li class="nav-item">
                        <a class="nav-link nav-link-1" href="<?= site_url('Literasi') ?>">Peraturan</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link nav-link-2" href="<?= site_url('Literasi/materi') ?>">Materi Kesiapsiagaan Bencana RS</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link nav-link-3" href="<?= site_url('Literasi/video') ?>">Video</a>
                    </li>
                    <li class="nav-item">
                        <a href="<?= site_url('Literasi/logout') ?>" class="nav-link nav-link-4" href="contact.html">Keluar</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <?= $contents; ?>

    <div class="tm-bg-gray pt-5 pb-3 tm-text-gray">
        <div class="container-fluid tm-container-small">
            <div class="row">
                <div class="col-lg-4 col-md-12 col-12 px-5 mb-5">
                    <h3 class="tm-text-primary mb-4">Bagian IKM-KK</h3>
                    <p>Fakultas Kedokteran Universitas Tadulako</p>
                </div>
                <div class="col-lg-6 col-md-6 col-sm-6 col-12 px-5 mb-5">
                    <h3 class="tm-text-primary mb-4">Our Links</h3>
                    <ul class="tm-footer-links pl-0">
                        <li class="mb-2"><a href="https://https://bnpb.go.id/">Badan Nasional Penanggulangan Bencana </a></li>
                        <li class="mb-2"><a href="https://bpbd-sultengprov.com/">Badan Penanggulangan Bencana Daerah Provinsi Sulteng </a></li>
                        <li class="mb-2"><a href="https://www.bmkg.go.id/">Badan Meteorologi, Klimatologi, dan Geofisika </a></li>
                        <li class="mb-2"><a href="https://dinkes.sultengprov.go.id/">Dinas Kesehatan Provinsi Sulawesi Tengah </a></li>
                        <li class="mb-2"><a href="https://dinkes.palukota.go.id/">Dinas Kesehatan Kota Palu </a></li>
                    </ul>
                </div>
                <div class="col-lg-2 col-md-6 col-sm-6 col-12 px-5 mb-5">
                    <ul class="tm-social-links d-flex justify-content-end pl-0 mb-5">
                        <li class="mb-2"><a href="https://facebook.com"><i class="fab fa-facebook"></i></a></li>
                        <li class="mb-2"><a href="https://twitter.com"><i class="fab fa-twitter"></i></a></li>
                        <li class="mb-2"><a href="https://instagram.com"><i class="fab fa-instagram"></i></a></li>
                        <li class="mb-2"><a href="https://pinterest.com"><i class="fab fa-pinterest"></i></a></li>
                    </ul>
                    <a href="#" class="tm-text-gray text-right d-block mb-2">Terms of Use</a>
                    <a href="#" class="tm-text-gray text-right d-block">Privacy Policy</a>
                </div>
            </div>

        </div>
    </div>

    <script src="<?= base_url() ?>assets/plugin_video/js/plugins.js"></script>
    <script>
        $(window).on("load", function() {
            $('body').addClass('loaded');
        });

        $(function() {
            /************** Video background *********/

            function setVideoSize() {
                const vidWidth = 1280;
                const vidHeight = 720;
                const maxVidHeight = 400;
                let windowWidth = window.innerWidth;
                let newVidWidth = windowWidth;
                let newVidHeight = windowWidth * vidHeight / vidWidth;
                let marginLeft = 0;
                let marginTop = 0;

                if (newVidHeight < maxVidHeight) {
                    newVidHeight = maxVidHeight;
                    newVidWidth = newVidHeight * vidWidth / vidHeight;
                }

                if (newVidWidth > windowWidth) {
                    marginLeft = -((newVidWidth - windowWidth) / 2);
                }

                if (newVidHeight > maxVidHeight) {
                    marginTop = -((newVidHeight - $('#tm-video-container').height()) / 2);
                }

                const tmVideo = $('#tm-video');

                tmVideo.css('width', newVidWidth);
                tmVideo.css('height', newVidHeight);
                tmVideo.css('margin-left', marginLeft);
                tmVideo.css('margin-top', marginTop);
            }

            setVideoSize();

            // Set video background size based on window size
            let timeout;
            window.onresize = function() {
                clearTimeout(timeout);
                timeout = setTimeout(setVideoSize, 100);
            };

            // Play/Pause button for video background      
            const btn = $("#tm-video-control-button");

            btn.on("click", function(e) {
                const video = document.getElementById("tm-video");
                $(this).removeClass();

                if (video.paused) {
                    video.play();
                    $(this).addClass("fas fa-pause");
                } else {
                    video.pause();
                    $(this).addClass("fas fa-play");
                }
            });
        });
    </script>
</body>

</html>