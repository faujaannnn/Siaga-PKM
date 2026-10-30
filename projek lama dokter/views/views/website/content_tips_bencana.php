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
                    <?php foreach ($tips_bencana as $tb) : ?>
                        <article class="blog-post mb-3">
                            <a href="<?= site_url('Baseweb/baca_tips_bencana/' . $tb->id) ?>">
                                <h2 class="font-weight-semibold mb-2"><?= $tb->judul ?></h2>
                            </a>
                            <header class="blog-post-header mb-4 lightbox" data-plugin-options="{'delegate': 'a', 'type': 'image', 'gallery': {'enabled': true}}">
                                <a class="lightbox" href="<?= base_url() ?>assets/img/tips_bencana/<?= $tb->gambar ?>">
                                    <span class="image-frame image-frame-style-1 image-frame-effect-1">
                                        <span class="image-frame-wrapper">

                                            <img cek-gambar="1" style="width: 100%;" src="<?= base_url() ?>assets/img/tips_bencana/<?= $tb->gambar ?>" class="lazyOwl img-fluid">

                                            <span class="image-frame-inner-border"></span>
                                            <span class="image-frame-action">
                                                <span><i class="fas fa-search-plus text-color-light"></i></span>
                                            </span>
                                            <span class="thumb-info-title">
                                                <span class="thumb-info-caption-text">

                                                </span>
                                            </span>
                                        </span>
                                    </span>
                                </a>

                            </header>
                            <div class="d-flex mb-3">
                                <span class="post-date text-color-primary mr-1 pr-2">
                                    <?= date('d-m-Y', strtotime($tb->tgl)) ?> </span>
                            </div>

                            <?= substr($tb->deskripsi, 0, 200) ?> ... <a href="<?= site_url('Baseweb/baca_tips_bencana/' . $tb->id) ?>">selengkapnya</a>

                        </article>

                        <hr class="tall">

                    <?php endforeach;
                    if (empty($pagination)) {
                        echo "";
                    } else { ?>

                        <hr class="tall">
                        <?= $pagination ?>

                        <hr class="tall">
                    <?php } ?>

                </div>
                <!-- end of main content -->

            </div>
        </div>
    </section>
</div>