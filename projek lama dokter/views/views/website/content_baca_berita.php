<div role="main" class="main">
    <!-- preloader section start -->
    <div class="loader-container">
        <span class="loader">
            <span class="loader-inner"></span>
        </span>
    </div>
    <section class="section section-height-3">
        <div class="container">
            <div class="row">
                <!-- sidebar -->
                <aside class="sidebar col-md-4 col-lg-4 order-2">

                    <div class="accordion accordion-default accordion-toggle accordion-style-1 mb-5" data-plugin-sticky="" data-plugin-options="{'offset_top': 100}" role="tablist" style="">
                        <div class="card">
                            <div class="card-header accordion-header" role="tab" id="popularPosts">
                                <h3 class="text-3 mb-0 text-color-primary"><a href="#" data-toggle="collapse" data-target="#togglePopularPosts" aria-expanded="false" aria-controls="togglePopularPosts">Berita Terkini</a></h3>
                            </div>
                            <div id="togglePopularPosts" class="accordion-body collapse show" aria-labelledby="popularPosts">
                                <div class="card-body">
                                    <?php foreach ($berita_terkini as $bt): ?>
                                        <article class="row align-items-center mb-3">
                                            <div class="col-4 pr-0">
                                                <a href="<?= site_url('Baseweb/baca_berita/' . $bt->id) ?>"><img src="<?= base_url() ?>assets/img/berita/<?= $bt->gambar ?>" class="img-fluid hover-effect-2" alt=""></a>
                                            </div>
                                            <div class="col-8">
                                                <h4 class="text-2 mb-0 text-color-primary"><a href="<?= site_url('Baseweb/baca_berita/' . $bt->id) ?>" class="text-1"><?= $bt->judul; ?></a></h4>
                                            </div>
                                        </article>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
                <!-- end of sidebar -->
                <!-- main content -->
                <div class="col-md-7 col-lg-7 order-1 mb-5 mb-md-0">
                    <article class="blog-post mb-4">
                        <h1 class="font-weight-bold text-color-primary mb-3 mt-3"><?= $berita['judul']; ?></h1>
                        <div class="d-flex mb-3">
                            <span class="post-date text-color-primary pr-3">
                                <?= date('d-m-Y' . ' | ' . 'H:i:s', strtotime($berita['tgl'])) ?> </span>
                            <span class="post-likes text-color-primary d-flex align-items-center border border-top-0 border-bottom-0 px-3">
                                <a href="#" class="text-color-primary">
                                    <!--i class="lnr lnr-eye text-3 mr-1" aria-label="5 users like this post"></i> 0 -->
                                    <i class="fas fa-eye text-3 mr-1" aria-label="5 users like this post"></i> <?= $berita['viewer']; ?>
                                </a>
                            </span>
                        </div>
                        <header class="blog-post-header mb-3 lightbox" data-plugin-options="{'delegate': 'a', 'type': 'image', 'gallery': {'enabled': true}}">
                            <div class="owl-carousel owl-theme dots-style-1 mb-3 mb-md-1 owl-loaded owl-drag owl-carousel-init" data-plugin-options="{'items': 1, 'dots': false, 'navtext': [], 'animateIn': 'fadeIn', 'animateOut': 'fadeOut','nav' : true}">
                                <div class="owl-stage-outer">
                                    <div class="owl-stage" style="transform: translate3d(-1270px, 0px, 0px); transition: all; width: 4445px;">
                                        <div class="owl-item cloned" style="width: 635px;">
                                            <div>
                                                <a class="lightbox" href="<?= base_url() ?>assets/img/berita/<?= $berita['gambar'] ?>">
                                                    <span class="image-frame image-frame-style-1 image-frame-effect-1">
                                                        <span class="image-frame-wrapper">
                                                            <img src="<?= base_url() ?>assets/img/berita/<?= $berita['gambar'] ?>" class="lazyOwl img-fluid" alt="Photo" title="">
                                                            <span class="image-frame-inner-border"></span>
                                                            <span class="image-frame-action">
                                                                <span class=""><i class="fa fa-search-location text-color-light"></i></span>
                                                            </span>
                                                            <span class="thumb-info-title">
                                                                <span class="thumb-info-caption-text">

                                                                </span>
                                                            </span>
                                                        </span>
                                                    </span>
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </header>
                        <p class="mb-2"></p>
                        <?= $berita['deskripsi']; ?>
                    </article>
                </div>
                <!-- end of main content -->

            </div>
        </div>
    </section>
    <section class="section section-height-2 bg-light-5 pb-5" id="terkini">
        <div class="container-fluid">
            <div class="row text-center">
                <div class="col">

                </div>
            </div>
        </div>
        <div class="container-fluid">
            <div class="row text-center">
                <div class="col">
                    <div class="overflow-hidden mb-3">
                        <h2 class="font-weight-bold mb-0 appear-animation animated maskUp appear-animation-visible" data-appear-animation="maskUp" data-appear-animation-delay="200" style="animation-delay: 200ms;">Berita Terbaru</h2>
                    </div>
                </div>
            </div>
        </div>
        <div class="container-fluid">
            <div class="row">
                <div class="col-10 col-sm-8 col-md-12 mx-auto d-flex overflow-hidden p-0 appear-animation animated" data-appear-animation="fadeInUpShorter" data-appear-animation-duration="700ms">
                    <div class="owl-carousel carousel-center-active-items carousel-center-active-items-style-3 owl-theme owl-loaded owl-drag owl-carousel-init" data-plugin-carousel="" data-plugin-options="{'autoplay': true, 'dots': false, 'nav': true, 'loop': true, 'margin': 30, 'responsive': { '0': {'items': 1}, '576': {'items': 1}, '768': {'items': 3}, '992': {'items': 3}, '1200': {'items': 5}}}">
                        <div class="owl-stage-outer">
                            <div class="owl-stage" style="transform: translate3d(-2072px, 0px, 0px); transition: all 0.25s ease 0s; width: 7877px;">
                                <?php foreach ($berita_terbaru as $b): ?>
                                    <div class="owl-item" style="width: 384.574px; margin-right: 30px;" tabindex="-1" aria-hidden="true">
                                        <div class="appear-animation animated" data-appear-animation="fadeInLeftShorter" data-appear-animation-delay="400">
                                            <article class="card rounded border-0 p-0">
                                                <a cek-gambar="1" href="<?= site_url('Baseweb/baca_berita/' . $b->id) ?>" aria-label="Move to top" data-uw-rm-empty-ctrl=""><img src="<?= base_url() ?>assets/img/berita/<?= $b->gambar ?>" class="card-img-top hover-effect-2" style="height: 250px;" data-uw-rm-alt-original="" data-uw-rm-alt="CT"></a>
                                                <div class="card-body">
                                                    <h3 class="font-weight-bold text-4 mb-1"><a href="<?= site_url('Baseweb/baca_berita/' . $b->id) ?>" class="link-color-dark"><?= $b->judul; ?></a></h3>
                                                    <span class="text-color-dark mb-3"><i class="far fa-clock text-color-primary"></i> <?= date('d-m-Y', strtotime($b->tgl)) ?></span>
                                                </div>
                                            </article>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                    <div class="owl-nav">
                        <button type="button" role="button" class="owl-prev" aria-label="Previous Slide" data-uw-rm-empty-ctrl="" data-uw-rm-kbnav="role" tabindex="0"></button>
                        <button type="button" role="button" class="owl-next" aria-label="Next Slide" data-uw-rm-empty-ctrl="" data-uw-rm-kbnav="role" tabindex="0"></button>
                    </div>
                    <div class="owl-dots disabled"></div>
                </div>
            </div>
        </div>

        <div class="container">
            <div class="row text-center">
                <div class="col">
                    <a href="<?= site_url('Baseweb/berita') ?>" class="btn btn-primary btn-rounded btn-4 text-0 font-weight-semibold">Indeks Berita</a>
                </div>
            </div>
        </div>
    </section>
</div>